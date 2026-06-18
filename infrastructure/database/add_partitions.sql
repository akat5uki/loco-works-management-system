-- Global Audit Trigger Function (Updated for Auto-Partitioning)
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data jsonb := '{}'::jsonb;
    v_new_data jsonb := '{}'::jsonb;
    v_pk_value text := '';
    v_user_id int;
    v_pk_part text;
    i int;

    -- Partition variables
    partition_date text;
    partition_name text;
    start_date text;
    end_date text;
BEGIN
    BEGIN
        v_user_id := COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), '0')::int;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := 0;
    END;

    IF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
    END IF;

    IF TG_NARGS > 0 THEN
        DECLARE
            parts text[] := '{}';
        BEGIN
            FOR i IN 0..(TG_NARGS - 1) LOOP
                IF (TG_OP = 'DELETE') THEN
                    v_pk_part := v_old_data ->> TG_ARGV[i];
                ELSE
                    v_pk_part := v_new_data ->> TG_ARGV[i];
                END IF;
                parts := array_append(parts, TG_ARGV[i] || ':' || COALESCE(v_pk_part, 'NULL'));
            END LOOP;
            v_pk_value := array_to_string(parts, ' | ');
        END;
    ELSE
        v_pk_value := 'UNKNOWN';
    END IF;

    -- Dynamically provision isolated Monthly Partitions
    partition_date := to_char(CURRENT_TIMESTAMP, 'YYYY_MM');
    partition_name := 'audit_logs_' || partition_date;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
          AND n.nspname = 'public'
    ) THEN
        start_date := to_char(date_trunc('month', CURRENT_TIMESTAMP), 'YYYY-MM-DD');
        end_date := to_char(date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month', 'YYYY-MM-DD');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_logs FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;

    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_pk,
        old_data,
        new_data,
        changed_by,
        changed_at
    ) VALUES (
        TG_TABLE_NAME::text,
        TG_OP,
        v_pk_value,
        v_old_data,
        v_new_data,
        v_user_id,
        CURRENT_TIMESTAMP
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
