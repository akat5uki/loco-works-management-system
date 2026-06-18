CREATE SCHEMA IF NOT EXISTS "public";

-- Tables
CREATE TABLE "public"."employee_category" (
    "category_id" int NOT NULL,
    "category_name" varchar NOT NULL UNIQUE,
    PRIMARY KEY ("category_id")
);

CREATE TABLE "public"."designation" (
    "designation_id" int NOT NULL,
    "designation_name" varchar NOT NULL,
    "category_id" int NOT NULL,
    PRIMARY KEY ("designation_id")
);

CREATE TABLE "public"."employees" (
    "ticket_number" int NOT NULL,
    "name" varchar NOT NULL,
    "designation_id" int NOT NULL,
    "password" varchar NOT NULL,
    "nonce" varchar NOT NULL,
    PRIMARY KEY ("ticket_number")
);

CREATE TABLE "public"."jobs" (
    "job_id" int NOT NULL,
    "job_description" varchar NOT NULL,
    "stage" int NOT NULL,
    PRIMARY KEY ("job_id")
);

INSERT INTO "public"."jobs" ("job_id", "job_description", "stage") VALUES
(501, 'IR value', 5),
(502, 'Power cable', 5),
(503, 'Panto calibration', 5),
(504, 'Battery cable continuity', 5),
(505, 'Indoor Light commissioning and screen cover opening', 5),
(506, 'Inside & outside screened control circuit cables continuity', 5),
(507, 'Polarity test', 5),
(508, 'Ratio test', 5),
(509, 'Auxiliary cable continuity', 5),
(510, 'Heater Ventilation and Crew fan continuity and resistance measurement', 5),
(511, 'Choke coil continuity', 5),
(512, 'PT cable meggering', 5),
(513, 'Schematic group 08 + RDSO MS 475, 503', 5),
(514, 'Schematic group 09 + FB, SR continuity', 5),
(515, 'Schematic group 05 + RDSO MS 495', 5),
(516, 'Schematic group 07 + RDSO MS 470, 500', 5),
(517, 'Schematic group 06 + RDSO MS 512, MSD 42', 5),
(518, 'Schematic group 10 + Air Dryer circuit', 5),
(519, 'Schematic group 11 + RDSO MS 505', 5),
(520, 'Schematic group 17 + RDSO MS 507', 5),
(521, 'MVR, MCR setting', 5),
(522, 'VCB timer setting', 5),
(523, 'First charging preparation', 5),
(524, 'VCB to close in D mode in simulation', 5),
(525, 'BUR contactor sequence', 5),
(526, 'Sensor test', 5),
(527, 'First charging in C & D modes from both cabs with all safety trippings', 5),
(528, 'Rotation of all auxiliary machines and battery charger performance', 5),
(529, 'BUR redundancy', 5),
(530, 'Auxiliary machines current measurement', 5),
(531, 'Attend Mechanical faults', 5),
(701, 'Special mode switch operations', 7),
(702, 'Commissioning of both SRs and Traction', 7),
(703, 'Lighting and signalling', 7),
(704, 'RDSO MS + MU VCU reset + ECO mode', 7),
(705, 'AC commissioning', 7),
(706, 'Air flow measurement', 7),
(707, 'Vibration measurement', 7),
(708, 'SPM entry and performance', 7),
(709, 'Earth fault rectification', 7),
(710, 'Normalisation for trial run', 7),
(711, 'Attend trial run faults', 7),
(712, 'DPWCS + RMS + Note software versions', 7),
(713, 'MU operations', 7),
(714, 'Normalisation for despatch', 7),
(715, 'Despatch work', 7),
(1, 'Miscellaneous work', 0),
(2, 'WAP-5 Scheduled Testing work', 0)
ON CONFLICT (job_id) DO NOTHING;



CREATE TABLE "public"."loco_type" (
    "loco_type_id" int NOT NULL,
    "loco_type_name" varchar NOT NULL UNIQUE,
    PRIMARY KEY ("loco_type_id")
);

CREATE TABLE "public"."loco" (
    "loco_number" int NOT NULL,
    "loco_type_id" int NOT NULL,
    "date_time" timestamptz NOT NULL,
    "stage" int NOT NULL,
    "shift" int NOT NULL,
    PRIMARY KEY ("loco_number")
);

CREATE TABLE "public"."employee_job_ratings" (
    "ticket_number" int NOT NULL,
    "job_id" int NOT NULL,
    "rating" int NOT NULL,
    PRIMARY KEY ("ticket_number", "job_id")
);

CREATE TABLE "public"."loco_bookings" (
    "loco_number" int NOT NULL,
    "date_time" timestamptz NOT NULL,
    "job_id" int NOT NULL,
    "ticket_number" int NOT NULL,
    "designation_id" int NOT NULL,
    PRIMARY KEY ("loco_number", "date_time", "job_id")
);

CREATE TABLE "public"."booking_tasks" (
    "task_id" bigserial NOT NULL,
    "loco_number" int NOT NULL,
    "date_time" timestamptz NOT NULL,
    "job_id" int NOT NULL,
    "task_description" text NOT NULL,
    PRIMARY KEY ("task_id"),
    CONSTRAINT "fk_booking_tasks_loco_bookings" 
        FOREIGN KEY ("loco_number", "date_time", "job_id") 
        REFERENCES "public"."loco_bookings"("loco_number", "date_time", "job_id") 
        ON DELETE CASCADE
);

CREATE TABLE "public"."audit_logs" (
    "id" bigserial NOT NULL,
    "table_name" text NOT NULL,
    "operation" text NOT NULL,
    "record_pk" text NOT NULL,
    "old_data" jsonb NOT NULL,
    "new_data" jsonb NOT NULL,
    "changed_by" int NOT NULL,
    "changed_at" timestamptz NOT NULL,
    PRIMARY KEY ("changed_at", "id")
) PARTITION BY RANGE ("changed_at");

-- Foreign key constraints
ALTER TABLE "public"."designation" ADD CONSTRAINT "fk_designation_category_id_employee_category_category_id" FOREIGN KEY("category_id") REFERENCES "public"."employee_category"("category_id");
ALTER TABLE "public"."employees" ADD CONSTRAINT "fk_employees_designation_id_designation_designation_id" FOREIGN KEY("designation_id") REFERENCES "public"."designation"("designation_id");
ALTER TABLE "public"."loco" ADD CONSTRAINT "fk_loco_loco_type_id_loco_type_loco_type_id" FOREIGN KEY("loco_type_id") REFERENCES "public"."loco_type"("loco_type_id");
ALTER TABLE "public"."employee_job_ratings" ADD CONSTRAINT "fk_employee_job_ratings_job_id_jobs_job_id" FOREIGN KEY("job_id") REFERENCES "public"."jobs"("job_id");
ALTER TABLE "public"."employee_job_ratings" ADD CONSTRAINT "fk_employee_job_ratings_ticket_number_employees" FOREIGN KEY("ticket_number") REFERENCES "public"."employees"("ticket_number");
ALTER TABLE "public"."loco_bookings" ADD CONSTRAINT "fk_loco_bookings_designation_id_designation_designation_id" FOREIGN KEY("designation_id") REFERENCES "public"."designation"("designation_id");
ALTER TABLE "public"."loco_bookings" ADD CONSTRAINT "fk_loco_bookings_job_id_jobs_job_id" FOREIGN KEY("job_id") REFERENCES "public"."jobs"("job_id");

ALTER TABLE "public"."loco_bookings" ADD CONSTRAINT "fk_loco_bookings_loco_number_loco_loco_number" FOREIGN KEY("loco_number") REFERENCES "public"."loco"("loco_number");
ALTER TABLE "public"."loco_bookings" ADD CONSTRAINT "fk_loco_bookings_ticket_number_employees_ticket_number" FOREIGN KEY("ticket_number") REFERENCES "public"."employees"("ticket_number");

-- Global Audit Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data jsonb := '{}'::jsonb;
    v_new_data jsonb := '{}'::jsonb;
    v_pk_value text := '';
    v_user_id int;
    v_pk_part text;
    i int;
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

-- Attaching triggers
CREATE TRIGGER trg_audit_employee_job_ratings AFTER INSERT OR UPDATE OR DELETE ON public.employee_job_ratings FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('ticket_number', 'job_id');
CREATE TRIGGER trg_audit_loco_type AFTER INSERT OR UPDATE OR DELETE ON public.loco_type FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('loco_type_id');
CREATE TRIGGER trg_audit_loco AFTER INSERT OR UPDATE OR DELETE ON public.loco FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('loco_number');
CREATE TRIGGER trg_audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('ticket_number');
CREATE TRIGGER trg_audit_booking_tasks AFTER INSERT OR UPDATE OR DELETE ON public.booking_tasks FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('task_id');
CREATE TRIGGER trg_audit_employee_category AFTER INSERT OR UPDATE OR DELETE ON public.employee_category FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('category_id');
CREATE TRIGGER trg_audit_designation AFTER INSERT OR UPDATE OR DELETE ON public.designation FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('designation_id');
CREATE TRIGGER trg_audit_loco_bookings AFTER INSERT OR UPDATE OR DELETE ON public.loco_bookings FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('loco_number', 'date_time', 'job_id');
CREATE TRIGGER trg_audit_jobs AFTER INSERT OR UPDATE OR DELETE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.process_audit_log('job_id');
