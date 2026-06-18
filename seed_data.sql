BEGIN;

-- Disable triggers/foreign keys temporarily or just TRUNCATE CASCADE
TRUNCATE TABLE
    employees,
    loco,
    loco_bookings,
    employee_job_ratings,
    booking_tasks,
    loco_type,
    jobs,
    designation,
    employee_category
CASCADE;

-- Populate employee_category
INSERT INTO employee_category (category_id, category_name) VALUES
(1, 'Supervisor'),
(2, 'Staff');

-- Populate designation
INSERT INTO designation (designation_id, designation_name, category_id) VALUES
(1, 'SSE', 1),
(2, 'JE', 1),
(3, 'Sr. Tech/MCM', 2),
(4, 'Tech-I', 2),
(5, 'Tech-II', 2),
(6, 'Tech-III', 2),
(7, 'Helper', 2);

-- Populate loco_type
INSERT INTO loco_type (loco_type_id, loco_type_name) VALUES
(1, 'WAG-9'),
(2, 'EF12K'),
(3, 'WAP-5');

-- Populate jobs
-- Assuming job_id is an integer, so stripping "JOB-"
INSERT INTO jobs (job_id, job_description, stage) VALUES
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
(2, 'WAP-5 Scheduled Testing work', 0);

COMMIT;
