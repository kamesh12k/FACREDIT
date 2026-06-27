-- ============================================================
-- Credits — Seed Data (v3)
-- Bootstrap Super Admin: username 'admin' / password 'admin'
-- (created automatically on first app startup, NOT by this script —
-- this seed only adds teachers, academic structure, and an example
-- Academic Calendar so the app isn't empty on first run).
--
-- All seeded teacher passwords: "password123"
-- Hash below is bcrypt("password123") (12 rounds).
-- ============================================================

-- ---------- DEPARTMENTS ----------
INSERT INTO departments (name, code) VALUES
    ('Computer Science', 'CS'),
    ('Mathematics', 'MA'),
    ('Physics', 'PH');

-- ---------- TEACHERS ----------
-- (role='teacher' rows authenticate via email; admin accounts are
-- handled separately by the app's bootstrap + Secondary Admin flow.)
INSERT INTO users (name, email, password_hash, role, department) VALUES
    ('Dr. Anita Sharma',  'anita.sharma@college.edu',  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'teacher', 'Computer Science'),
    ('Dr. Rajesh Kumar',  'rajesh.kumar@college.edu',  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'teacher', 'Computer Science'),
    ('Prof. Meena Iyer',  'meena.iyer@college.edu',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'teacher', 'Mathematics'),
    ('Prof. Vikram Rao',  'vikram.rao@college.edu',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'teacher', 'Mathematics'),
    ('Dr. Sunita Patel',  'sunita.patel@college.edu',  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'teacher', 'Physics'),
    ('Prof. Arjun Nair',  'arjun.nair@college.edu',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'teacher', 'Physics');

INSERT INTO teacher_credits (teacher_id, balance)
SELECT id, 0 FROM users WHERE role = 'teacher';

-- ---------- SUBJECTS ----------
INSERT INTO subjects (code, name, subject_type, credits, department_id, semester) VALUES
    ('CS301', 'Data Structures',   'theory', 4, (SELECT id FROM departments WHERE code = 'CS'), 3),
    ('CS302', 'Algorithms',        'theory', 4, (SELECT id FROM departments WHERE code = 'CS'), 3),
    ('CS303', 'Database Systems',  'theory', 3, (SELECT id FROM departments WHERE code = 'CS'), 3),
    ('CS304', 'Operating Systems', 'theory', 3, (SELECT id FROM departments WHERE code = 'CS'), 4),
    ('MA201', 'Calculus II',       'theory', 4, (SELECT id FROM departments WHERE code = 'MA'), 2),
    ('MA202', 'Linear Algebra',    'theory', 3, (SELECT id FROM departments WHERE code = 'MA'), 2),
    ('PH101', 'Mechanics',         'theory', 4, (SELECT id FROM departments WHERE code = 'PH'), 1),
    ('PH102', 'Thermodynamics',    'theory', 3, (SELECT id FROM departments WHERE code = 'PH'), 1);

-- ---------- CLASSES ----------
INSERT INTO classes (name, section, department_id, semester) VALUES
    ('III B.Sc CS',  'A', (SELECT id FROM departments WHERE code = 'CS'), 3),
    ('III B.Sc CS',  'B', (SELECT id FROM departments WHERE code = 'CS'), 3),
    ('II B.Sc Maths','A', (SELECT id FROM departments WHERE code = 'MA'), 2),
    ('I B.Sc Physics','A',(SELECT id FROM departments WHERE code = 'PH'), 1);

-- ---------- ROOMS ----------
INSERT INTO rooms (room_number, room_type, capacity, department_id) VALUES
    ('CS-101', 'classroom', 60, (SELECT id FROM departments WHERE code = 'CS')),
    ('CS-102', 'lab',       30, (SELECT id FROM departments WHERE code = 'CS')),
    ('MA-101', 'classroom', 50, (SELECT id FROM departments WHERE code = 'MA')),
    ('PH-101', 'lab',       25, (SELECT id FROM departments WHERE code = 'PH'));

-- ---------- ACADEMIC YEAR + SEMESTER ----------
INSERT INTO academic_years (name, start_date, end_date) VALUES
    ('2026-2027', '2026-06-01', '2027-04-30');

INSERT INTO semesters (academic_year_id, name, start_date, end_date) VALUES
    ((SELECT id FROM academic_years WHERE name = '2026-2027'), 'Odd Semester', '2026-06-01', '2026-11-30');

-- ---------- CALENDAR DAYS (example week: Day Order rotation + one holiday) ----------
-- Demonstrates the pause/resume example from the spec: DO 3 -> Holiday -> DO 4
INSERT INTO calendar_days (date, day_type, day_order, academic_year_id, semester_id, is_manual_override) VALUES
    ('2026-08-24', 'working', 3, (SELECT id FROM academic_years WHERE name = '2026-2027'), (SELECT id FROM semesters WHERE name = 'Odd Semester'), true),
    ('2026-08-25', 'holiday', NULL, (SELECT id FROM academic_years WHERE name = '2026-2027'), (SELECT id FROM semesters WHERE name = 'Odd Semester'), false),
    ('2026-08-26', 'working', 4, (SELECT id FROM academic_years WHERE name = '2026-2027'), (SELECT id FROM semesters WHERE name = 'Odd Semester'), false);

-- Label the holiday for clarity
UPDATE calendar_days SET label = 'Example Holiday' WHERE date = '2026-08-25';

-- ---------- TIMETABLE SLOTS (Day Order based, 5 periods/day) ----------
-- Dr. Anita Sharma — Data Structures + Algorithms across DO 1 and DO 3
INSERT INTO timetable_slots (teacher_id, subject_id, class_id, room_id, day_order, period_number) VALUES
    ((SELECT id FROM users WHERE email = 'anita.sharma@college.edu'),
     (SELECT id FROM subjects WHERE code = 'CS301'),
     (SELECT id FROM classes WHERE name = 'III B.Sc CS' AND section = 'A'),
     (SELECT id FROM rooms WHERE room_number = 'CS-101'), 1, 1),
    ((SELECT id FROM users WHERE email = 'anita.sharma@college.edu'),
     (SELECT id FROM subjects WHERE code = 'CS302'),
     (SELECT id FROM classes WHERE name = 'III B.Sc CS' AND section = 'A'),
     (SELECT id FROM rooms WHERE room_number = 'CS-101'), 3, 1);

-- Dr. Rajesh Kumar — Database Systems on DO 1 P2, Operating Systems on DO 4 P1
INSERT INTO timetable_slots (teacher_id, subject_id, class_id, room_id, day_order, period_number) VALUES
    ((SELECT id FROM users WHERE email = 'rajesh.kumar@college.edu'),
     (SELECT id FROM subjects WHERE code = 'CS303'),
     (SELECT id FROM classes WHERE name = 'III B.Sc CS' AND section = 'B'),
     (SELECT id FROM rooms WHERE room_number = 'CS-102'), 1, 2),
    ((SELECT id FROM users WHERE email = 'rajesh.kumar@college.edu'),
     (SELECT id FROM subjects WHERE code = 'CS304'),
     (SELECT id FROM classes WHERE name = 'III B.Sc CS' AND section = 'B'),
     (SELECT id FROM rooms WHERE room_number = 'CS-102'), 4, 1);

-- Prof. Meena Iyer — Calculus II on DO 1 P3
INSERT INTO timetable_slots (teacher_id, subject_id, class_id, room_id, day_order, period_number) VALUES
    ((SELECT id FROM users WHERE email = 'meena.iyer@college.edu'),
     (SELECT id FROM subjects WHERE code = 'MA201'),
     (SELECT id FROM classes WHERE name = 'II B.Sc Maths' AND section = 'A'),
     (SELECT id FROM rooms WHERE room_number = 'MA-101'), 1, 3);

-- Dr. Sunita Patel — Mechanics on DO 1 P4
INSERT INTO timetable_slots (teacher_id, subject_id, class_id, room_id, day_order, period_number) VALUES
    ((SELECT id FROM users WHERE email = 'sunita.patel@college.edu'),
     (SELECT id FROM subjects WHERE code = 'PH101'),
     (SELECT id FROM classes WHERE name = 'I B.Sc Physics' AND section = 'A'),
     (SELECT id FROM rooms WHERE room_number = 'PH-101'), 1, 4);

-- ---------- LEAVE REQUESTS (Day-Order resolved at submission time) ----------
-- Example 1: Approved + substitute assigned. Anita Sharma's DO-1 P1 leave
-- (Rajesh/Meena/Vikram/Sunita/Arjun have no DO-1 P1 slot, so any of them
-- could substitute — Rajesh is picked here).
INSERT INTO leave_requests (teacher_id, date, day_order, period_number, reason, status) VALUES
    ((SELECT id FROM users WHERE email = 'anita.sharma@college.edu'), '2026-08-24', 3, 1, 'Medical leave', 'approved');

INSERT INTO alter_assignments (leave_request_id, substitute_teacher_id) VALUES
    ((SELECT id FROM leave_requests WHERE teacher_id = (SELECT id FROM users WHERE email = 'anita.sharma@college.edu') AND date = '2026-08-24'),
     (SELECT id FROM users WHERE email = 'rajesh.kumar@college.edu'));

INSERT INTO credit_transactions (teacher_id, change, reason, related_leave_id) VALUES
    ((SELECT id FROM users WHERE email = 'anita.sharma@college.edu'), -1, 'Leave on 2026-08-24 (Day Order 3) period 1',
     (SELECT id FROM leave_requests WHERE teacher_id = (SELECT id FROM users WHERE email = 'anita.sharma@college.edu') AND date = '2026-08-24')),
    ((SELECT id FROM users WHERE email = 'rajesh.kumar@college.edu'), +1, 'Substitute on 2026-08-24 (Day Order 3) period 1',
     (SELECT id FROM leave_requests WHERE teacher_id = (SELECT id FROM users WHERE email = 'anita.sharma@college.edu') AND date = '2026-08-24'));

UPDATE teacher_credits SET balance = -1 WHERE teacher_id = (SELECT id FROM users WHERE email = 'anita.sharma@college.edu');
UPDATE teacher_credits SET balance = +1 WHERE teacher_id = (SELECT id FROM users WHERE email = 'rajesh.kumar@college.edu');

-- Example 2: Pending request (Meena Iyer, DO 4 — a working day with no holiday in between)
INSERT INTO leave_requests (teacher_id, date, day_order, period_number, reason, status) VALUES
    ((SELECT id FROM users WHERE email = 'meena.iyer@college.edu'), '2026-08-26', 4, 2, 'Conference attendance', 'pending');

-- Example 3: Rejected request (Vikram Rao)
INSERT INTO leave_requests (teacher_id, date, day_order, period_number, reason, status) VALUES
    ((SELECT id FROM users WHERE email = 'vikram.rao@college.edu'), '2026-08-26', 4, 4, 'Personal reason', 'rejected');

-- NOTE: 2026-08-25 (the holiday in this seed) deliberately has NO leave
-- requests, timetable slots, or credit transactions — that's the
-- enforcement the application layer guarantees going forward.
