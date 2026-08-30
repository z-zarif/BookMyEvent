DROP TRIGGER IF EXISTS trg_add_money_request_approved ON ADD_MONEY_REQUESTS;
DROP TRIGGER IF EXISTS trg_wallet_transactions_apply ON WALLET_TRANSACTIONS;
DROP TRIGGER IF EXISTS trg_wallet_guard_balance ON WALLETS;
DROP TRIGGER IF EXISTS trg_tickets_sync_booking_total ON tickets;
DROP TRIGGER IF EXISTS trg_reserve_ticket ON tickets;        -- was trg_tickets_reserve
DROP TRIGGER IF EXISTS trg_release_ticket ON tickets;        -- was trg_tickets_release
DROP TRIGGER IF EXISTS trg_ticket_type_auto_status ON ticket_type;
DROP TRIGGER IF EXISTS trg_ticket_type_audit ON ticket_type;

DROP FUNCTION IF EXISTS fn_add_money_request_approved();
DROP FUNCTION IF EXISTS fn_apply_wallet_transactions();      -- was fn_apply_wallet_transaction (missing the 's')
DROP FUNCTION IF EXISTS fn_wallet_guard_balance();
DROP FUNCTION IF EXISTS fn_sync_booking_total();
DROP FUNCTION IF EXISTS fn_reserve_ticket();
DROP FUNCTION IF EXISTS fn_release_ticket();
DROP FUNCTION IF EXISTS fn_ticket_type_auto_status();
DROP FUNCTION IF EXISTS fn_log_ticket_type_change();
DROP FUNCTION IF EXISTS fn_generate_id(VARCHAR);

CREATE OR REPLACE FUNCTION fn_generate_id(prefix VARCHAR)
RETURNS CHAR(15) AS $$
BEGIN
  RETURN UPPER(prefix) ||
         SUBSTRING(MD5(CLOCK_TIMESTAMP()::TEXT || RANDOM()::TEXT), 1, 15 - LENGTH(prefix));
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION fn_log_ticket_type_change()
RETURNS TRIGGER AS $$ 
BEGIN 
    IF(OLD.QUANTITY_AVAILABLE IS DISTINCT FROM NEW.QUANTITY_AVAILABLE) OR (OLD.STATUS IS DISTINCT FROM NEW.STATUS) THEN 
    INSERT INTO TICKET_AUDIT_LOG 
    (LOG_ID,TYPE_ID,OLD_QUANTITY,NEW_QUANTITY,OLD_STATUS,NEW_STATUS,CHANGED_AT)
    VALUES
    (fn_generate_id('LOG'),NEW.TYPE_ID,OLD.QUANTITY_AVAILABLE,NEW.QUANTITY_AVAILABLE,OLD.STATUS,NEW.STATUS,CURRENT_TIMESTAMP);
    END IF; 
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_type_audit
AFTER UPDATE ON ticket_type
FOR EACH ROW 
EXECUTE FUNCTION fn_log_ticket_type_change();



CREATE OR REPLACE FUNCTION fn_ticket_type_auto_status() 
RETURNS TRIGGER AS 
$$
BEGIN 
    IF NEW.QUANTITY_AVAILABLE<=0 AND NEW.STATUS='active' THEN 
    NEW.STATUS := 'inactive';
    END IF;
    RETURN NEW;
    END; 
    $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_type_auto_status
BEFORE UPDATE ON ticket_type
FOR EACH ROW 
EXECUTE FUNCTION fn_ticket_type_auto_status();


CREATE OR REPLACE FUNCTION fn_reserve_ticket()
RETURNS TRIGGER AS
$$
DECLARE 
    v_available INTEGER;
    v_status VARCHAR(20);
BEGIN 
    SELECT QUANTITY_AVAILABLE, STATUS INTO v_available,v_status
    FROM TICKET_TYPE
    WHERE TYPE_ID=NEW.TYPE_ID
    FOR UPDATE;

    IF NOT FOUND THEN 
    RAISE EXCEPTION 'Ticket type % does not exist',NEW.TICKET_TYPE_ID;
    END IF;
    IF v_status <> 'active' THEN 
    RAISE EXCEPTION 'Ticket type % is not on sale', NEW.TICKET_TYPE_ID;
    END IF;
    IF v_available<=0 THEN 
    RAISE EXCEPTION 'Sorry, Tickets are sold out!!';
    END IF;

    UPDATE TICKET_TYPE
    SET QUANTITY_AVAILABLE=QUANTITY_AVAILABLE-1
    WHERE TYPE_ID=NEW.TYPE_ID;
    RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reserve_ticket
BEFORE INSERT ON TICKETS
FOR EACH ROW 
EXECUTE FUNCTION fn_reserve_ticket();



CREATE OR REPLACE FUNCTION fn_release_ticket()
RETURNS TRIGGER AS
$$
BEGIN 
UPDATE TICKET_TYPE
SET QUANTITY_AVAILABLE=QUANTITY_AVAILABLE+1
WHERE TYPE_ID=OLD.TYPE_ID;
RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_release_ticket
AFTER DELETE ON TICKETS 
FOR EACH ROW 
EXECUTE FUNCTION fn_release_ticket();

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


CREATE OR REPLACE FUNCTION fn_wallet_guard_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.BALANCE< 0 THEN
    RAISE EXCEPTION 'WALLET BALANCE CANNOT BE LESS THAN 0';
    END IF;
    RETURN NEW;
    END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_wallet_guard_balance
BEFORE UPDATE ON WALLETS
FOR EACH ROW 
EXECUTE FUNCTION fn_wallet_guard_balance();


CREATE OR REPLACE FUNCTION fn_apply_wallet_transactions()
RETURNS TRIGGER AS $$
DECLARE 
    v_type VARCHAR(20);
    v_current_balance NUMERIC(10,2);
BEGIN 
    v_type := NEW.type;
  
    IF v_type NOT IN ('DEPOSIT', 'PAYMENT', 'REFUND') THEN
    RAISE EXCEPTION 'Invalid wallet transaction type: %', NEW.TYPE;
  END IF;

  IF NEW.AMOUNT <= 0 THEN
    RAISE EXCEPTION 'Wallet transaction amount must be positive (got %)', NEW.AMOUNT;
  END IF;

SELECT BALANCE INTO v_current_balance 
FROM WALLETS 
WHERE WALLET_ID=NEW.WALLET_ID
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
  ELSE 
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
EXECUTE FUNCTION fn_apply_wallet_transactions();



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
