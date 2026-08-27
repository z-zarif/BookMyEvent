CREATE SEQUENCE IF NOT EXISTS ticket_audit_log_seq;

CREATE OR REPLACE FUNCTION log_ticket_type_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old_qty    INTEGER := NULL;
    v_new_qty    INTEGER := NULL;
    v_old_status VARCHAR(20) := NULL;
    v_new_status VARCHAR(20) := NULL;
    v_log_id     CHAR(15);
BEGIN
    IF NEW.QUANTITY_AVAILABLE IS DISTINCT FROM OLD.QUANTITY_AVAILABLE THEN
        v_old_qty := OLD.QUANTITY_AVAILABLE;
        v_new_qty := NEW.QUANTITY_AVAILABLE;
    END IF;

    IF NEW.STATUS IS DISTINCT FROM OLD.STATUS THEN
        v_old_status := OLD.STATUS;
        v_new_status := NEW.STATUS;
    END IF;

    -- defensive: nothing actually changed, skip logging
    IF v_old_qty IS NULL AND v_new_qty IS NULL
       AND v_old_status IS NULL AND v_new_status IS NULL THEN
        RETURN NEW;
    END IF;

    v_log_id := 'LOG' || LPAD(nextval('ticket_audit_log_seq')::text, 12, '0');

    INSERT INTO TICKET_AUDIT_LOG (
        LOG_ID, TYPE_ID, OLD_QUANTITY, NEW_QUANTITY, OLD_STATUS, NEW_STATUS
    ) VALUES (
        v_log_id, NEW.TYPE_ID, v_old_qty, v_new_qty, v_old_status, v_new_status
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;




CREATE TRIGGER trg_log_ticket_type_change
AFTER UPDATE OF QUANTITY_AVAILABLE, STATUS ON ticket_type
FOR EACH ROW
EXECUTE FUNCTION log_ticket_type_change();



CREATE OR REPLACE FUNCTION sync_wallet_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_new_balance NUMERIC(10,2);
BEGIN
    IF NEW.TYPE IN ('deposit', 'refund') THEN
        UPDATE WALLETS
        SET BALANCE = BALANCE + NEW.AMOUNT,
            LAST_USED = CURRENT_TIMESTAMP
        WHERE WALLET_ID = NEW.WALLET_ID
        RETURNING BALANCE INTO v_new_balance;

    ELSIF NEW.TYPE = 'payment' THEN
        UPDATE WALLETS
        SET BALANCE = BALANCE - NEW.AMOUNT,
            LAST_USED = CURRENT_TIMESTAMP
        WHERE WALLET_ID = NEW.WALLET_ID
        RETURNING BALANCE INTO v_new_balance;

    ELSE
        RAISE EXCEPTION 'Unknown wallet transaction type: %', NEW.TYPE;
    END IF;

    UPDATE WALLET_TRANSACTIONS
    SET BALANCE_AFTER = v_new_balance
    WHERE TRANSACTION_ID = NEW.TRANSACTION_ID;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT ON WALLET_TRANSACTIONS
FOR EACH ROW
EXECUTE FUNCTION sync_wallet_balance();