-- =====================================================================
-- triggers.sql
-- BookMyEvent — trigger layer
-- Dialect: PostgreSQL (plpgsql)
--
-- Covers:
--   1. Ticket inventory reservation / release (tickets <-> ticket_type)
--   2. ticket_type change auditing -> TICKET_AUDIT_LOG
--   3. Auto-deactivate a ticket_type once sold out
--   4. BOOKINGS.TOTAL_COST kept in sync with its tickets
--   5. Wallet balance integrity (never negative)
--   6. WALLET_TRANSACTIONS applied to WALLETS.BALANCE
--   7. ADD_MONEY_REQUESTS approval -> auto deposit transaction
--
-- Note: none of the CHAR(15) primary keys in schema.sql have a
-- default/sequence defined, so fn_generate_id() below produces a
-- pseudo-random 15-char id for rows inserted BY these triggers
-- (TICKET_AUDIT_LOG.LOG_ID, WALLET_TRANSACTIONS.TRANSACTION_ID).
-- Swap this for a real sequence/UUID strategy when you move past demo data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cleanup (idempotent re-run, mirrors the DROP ... IF EXISTS at the
-- top of schema.sql)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_add_money_request_approved ON ADD_MONEY_REQUESTS;
DROP TRIGGER IF EXISTS trg_wallet_transactions_apply ON WALLET_TRANSACTIONS;
DROP TRIGGER IF EXISTS trg_wallet_guard_balance ON WALLETS;
DROP TRIGGER IF EXISTS trg_tickets_sync_booking_total ON tickets;
DROP TRIGGER IF EXISTS trg_tickets_release ON tickets;
DROP TRIGGER IF EXISTS trg_tickets_reserve ON tickets;
DROP TRIGGER IF EXISTS trg_ticket_type_auto_status ON ticket_type;
DROP TRIGGER IF EXISTS trg_ticket_type_audit ON ticket_type;

DROP FUNCTION IF EXISTS fn_add_money_request_approved();
DROP FUNCTION IF EXISTS fn_apply_wallet_transaction();
DROP FUNCTION IF EXISTS fn_wallet_guard_balance();
DROP FUNCTION IF EXISTS fn_sync_booking_total();
DROP FUNCTION IF EXISTS fn_release_ticket();
DROP FUNCTION IF EXISTS fn_reserve_ticket();
DROP FUNCTION IF EXISTS fn_ticket_type_auto_status();
DROP FUNCTION IF EXISTS fn_log_ticket_type_change();
DROP FUNCTION IF EXISTS fn_generate_id(VARCHAR);


-- =====================================================================
-- 0. Utility: 15-char id generator for trigger-inserted rows
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_generate_id(prefix VARCHAR)
RETURNS CHAR(15) AS $$
BEGIN
  RETURN UPPER(prefix) ||
         SUBSTRING(MD5(CLOCK_TIMESTAMP()::TEXT || RANDOM()::TEXT), 1, 15 - LENGTH(prefix));
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- 1. TICKET_TYPE auditing — logs every quantity/status change,
--    regardless of what caused it
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_log_ticket_type_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.QUANTITY_AVAILABLE IS DISTINCT FROM NEW.QUANTITY_AVAILABLE)
     OR (OLD.STATUS IS DISTINCT FROM NEW.STATUS) THEN
    INSERT INTO TICKET_AUDIT_LOG
      (LOG_ID, TYPE_ID, OLD_QUANTITY, NEW_QUANTITY, OLD_STATUS, NEW_STATUS, CHANGED_AT)
    VALUES
      (fn_generate_id('LOG'), NEW.TYPE_ID, OLD.QUANTITY_AVAILABLE, NEW.QUANTITY_AVAILABLE,
       OLD.STATUS, NEW.STATUS, CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_type_audit
AFTER UPDATE ON ticket_type
FOR EACH ROW
EXECUTE FUNCTION fn_log_ticket_type_change();


-- =====================================================================
-- 2. Auto-deactivate a ticket_type once it sells out.
--    Deliberately one-directional: it will flip active -> inactive at
--    zero stock, but will NOT auto-reactivate on restock, so it never
--    overrides an organizer's manual pause.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_ticket_type_auto_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.QUANTITY_AVAILABLE <= 0 AND NEW.STATUS = 'active' THEN
    NEW.STATUS := 'inactive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_type_auto_status
BEFORE UPDATE ON ticket_type
FOR EACH ROW
EXECUTE FUNCTION fn_ticket_type_auto_status();


-- =====================================================================
-- 3. Reserve inventory when a ticket is issued.
--    Locks the ticket_type row, validates it's on sale and in stock,
--    then decrements QUANTITY_AVAILABLE (which in turn fires #1/#2).
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_reserve_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_available INTEGER;
  v_status    VARCHAR(20);
BEGIN
  SELECT QUANTITY_AVAILABLE, STATUS INTO v_available, v_status
  FROM ticket_type
  WHERE TYPE_ID = NEW.TICKET_TYPE_ID
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket type % does not exist', NEW.TICKET_TYPE_ID;
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Ticket type % is not on sale (status: %)', NEW.TICKET_TYPE_ID, v_status;
  END IF;

  IF v_available <= 0 THEN
    RAISE EXCEPTION 'No tickets remaining for ticket type %', NEW.TICKET_TYPE_ID;
  END IF;

  UPDATE ticket_type
  SET QUANTITY_AVAILABLE = QUANTITY_AVAILABLE - 1
  WHERE TYPE_ID = NEW.TICKET_TYPE_ID;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_reserve
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION fn_reserve_ticket();


-- =====================================================================
-- 4. Release inventory when a ticket is deleted — covers direct
--    deletes AND the ON DELETE CASCADE from a cancelled/removed booking.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_release_ticket()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ticket_type
  SET QUANTITY_AVAILABLE = QUANTITY_AVAILABLE + 1
  WHERE TYPE_ID = OLD.TICKET_TYPE_ID;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_release
AFTER DELETE ON tickets
FOR EACH ROW
EXECUTE FUNCTION fn_release_ticket();


-- =====================================================================
-- 5. Keep BOOKINGS.TOTAL_COST in sync with the sum of its tickets
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_sync_booking_total()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_id CHAR(15);
BEGIN
  v_booking_id := COALESCE(NEW.BOOKING_ID, OLD.BOOKING_ID);

  UPDATE BOOKINGS
  SET TOTAL_COST = COALESCE(
        (SELECT SUM(PRICE_PAID) FROM tickets WHERE BOOKING_ID = v_booking_id), 0)
  WHERE BOOKING_ID = v_booking_id;

  RETURN NULL; -- AFTER-trigger return value is ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_sync_booking_total
AFTER INSERT OR DELETE ON tickets
FOR EACH ROW
EXECUTE FUNCTION fn_sync_booking_total();


-- =====================================================================
-- 6. Safety net: a wallet's balance must never go negative, no matter
--    what code path updated it.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_wallet_guard_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.BALANCE < 0 THEN
    RAISE EXCEPTION 'Wallet % balance cannot go negative (attempted: %)',
      NEW.WALLET_ID, NEW.BALANCE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_guard_balance
BEFORE UPDATE OF BALANCE ON WALLETS
FOR EACH ROW
EXECUTE FUNCTION fn_wallet_guard_balance();


-- =====================================================================
-- 7. Apply a WALLET_TRANSACTIONS row to the owning wallet's balance.
--    This is the single entry point for changing a wallet's balance —
--    app code should INSERT here rather than UPDATE WALLETS directly.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_apply_wallet_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_current_balance NUMERIC(10,2);
  v_type             VARCHAR(20);
BEGIN
  v_type := UPPER(NEW.TYPE);

  IF v_type NOT IN ('DEPOSIT', 'PAYMENT', 'REFUND') THEN
    RAISE EXCEPTION 'Invalid wallet transaction type: %', NEW.TYPE;
  END IF;

  IF NEW.AMOUNT <= 0 THEN
    RAISE EXCEPTION 'Wallet transaction amount must be positive (got %)', NEW.AMOUNT;
  END IF;

  SELECT BALANCE INTO v_current_balance
  FROM WALLETS
  WHERE WALLET_ID = NEW.WALLET_ID
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet % does not exist', NEW.WALLET_ID;
  END IF;

  IF v_type = 'PAYMENT' THEN
    IF v_current_balance < NEW.AMOUNT THEN
      RAISE EXCEPTION 'Insufficient balance in wallet % (balance: %, required: %)',
        NEW.WALLET_ID, v_current_balance, NEW.AMOUNT;
    END IF;
    v_current_balance := v_current_balance - NEW.AMOUNT;
  ELSE -- DEPOSIT or REFUND
    v_current_balance := v_current_balance + NEW.AMOUNT;
  END IF;

  NEW.BALANCE_AFTER := v_current_balance;

  UPDATE WALLETS
  SET BALANCE = v_current_balance,
      LAST_USED = CURRENT_TIMESTAMP
  WHERE WALLET_ID = NEW.WALLET_ID;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_transactions_apply
BEFORE INSERT ON WALLET_TRANSACTIONS
FOR EACH ROW
EXECUTE FUNCTION fn_apply_wallet_transaction();


-- =====================================================================
-- 8. When an ADD_MONEY_REQUESTS row is approved, auto-create the
--    matching deposit in WALLET_TRANSACTIONS (which triggers #7)
--    and stamp PROCESSED_AT.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_add_money_request_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_id CHAR(15);
BEGIN
  IF UPPER(NEW.STATUS) = 'APPROVED' THEN
    SELECT WALLET_ID INTO v_wallet_id
    FROM WALLETS
    WHERE USER_ID = NEW.USER_ID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No wallet found for user %', NEW.USER_ID;
    END IF;

    INSERT INTO WALLET_TRANSACTIONS
      (TRANSACTION_ID, WALLET_ID, TYPE, AMOUNT, REASON, REFERENCE_ID, HAPPENED_AT)
    VALUES
      (fn_generate_id('WTX'), v_wallet_id, 'deposit', NEW.AMOUNT,
       'Add money request approved', NEW.REQUEST_ID, CURRENT_TIMESTAMP);

    NEW.PROCESSED_AT := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_add_money_request_approved
BEFORE UPDATE ON ADD_MONEY_REQUESTS
FOR EACH ROW
WHEN (OLD.STATUS IS DISTINCT FROM NEW.STATUS)
EXECUTE FUNCTION fn_add_money_request_approved();