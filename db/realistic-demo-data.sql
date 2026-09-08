-- Real catalogue and multi-user demo data. Run after db/fresh-start.sql.
-- This intentionally contains no fictional catalogue titles or theses.
-- Test-account password: Test1234!
-- Import only into a fresh database, or first remove rows created by DEMO-REAL.

START TRANSACTION;

SELECT id INTO @type_id FROM book_types WHERE is_active = 1 ORDER BY id LIMIT 1;

INSERT INTO users (student_employee_id, barcode, email, name, password_hash, role, is_active, must_change_password, address, contact) VALUES
('DEMO-REAL-001', 'DEMO-REAL-001', 'mika.santos@example.test', 'Mika Santos', '$2b$12$MadSOwDTbsmFJcnkp5qoruJvbsF1ZWJSaZ26/.MpTDCYbZyc25qD2', 'student', 1, 0, 'Candelaria, Quezon', '09170000001'),
('DEMO-REAL-002', 'DEMO-REAL-002', 'paolo.reyes@example.test', 'Paolo Reyes', '$2b$12$MadSOwDTbsmFJcnkp5qoruJvbsF1ZWJSaZ26/.MpTDCYbZyc25qD2', 'student', 1, 0, 'Sariaya, Quezon', '09170000002'),
('DEMO-REAL-003', 'DEMO-REAL-003', 'lea.cruz@example.test', 'Lea Cruz', '$2b$12$MadSOwDTbsmFJcnkp5qoruJvbsF1ZWJSaZ26/.MpTDCYbZyc25qD2', 'student', 1, 0, 'Lucena City, Quezon', '09170000003'),
('DEMO-REAL-004', 'DEMO-REAL-004', 'andre.garcia@example.test', 'Andre Garcia', '$2b$12$MadSOwDTbsmFJcnkp5qoruJvbsF1ZWJSaZ26/.MpTDCYbZyc25qD2', 'student', 1, 0, 'Tiaong, Quezon', '09170000004'),
('DEMO-REAL-005', 'DEMO-REAL-005', 'nina.lim@example.test', 'Nina Lim', '$2b$12$MadSOwDTbsmFJcnkp5qoruJvbsF1ZWJSaZ26/.MpTDCYbZyc25qD2', 'student', 1, 0, 'San Juan, Batangas', '09170000005');

SELECT id INTO @mika FROM users WHERE student_employee_id = 'DEMO-REAL-001';
SELECT id INTO @paolo FROM users WHERE student_employee_id = 'DEMO-REAL-002';
SELECT id INTO @lea FROM users WHERE student_employee_id = 'DEMO-REAL-003';
SELECT id INTO @andre FROM users WHERE student_employee_id = 'DEMO-REAL-004';
SELECT id INTO @nina FROM users WHERE student_employee_id = 'DEMO-REAL-005';

-- General and computing books are real ISBN-bearing editions.
INSERT INTO books (title, material_type, metadata, book_type_id, author, isbn, copies, created_by) VALUES
('Database System Concepts', 'book', JSON_OBJECT('category','Computer Science','edition','5th','publication_year',2006,'location','CS-01'), @type_id, 'Abraham Silberschatz, Henry F. Korth, S. Sudarshan', '9780072958867', 1, 'DEMO-REAL'),
('Designing Data-Intensive Applications', 'book', JSON_OBJECT('category','Computer Science','edition','1st','publication_year',2017,'location','CS-01'), @type_id, 'Martin Kleppmann', '9781449373320', 1, 'DEMO-REAL'),
('Joe Celko''s Data and Databases: Concepts in Practice', 'book', JSON_OBJECT('category','Computer Science','edition','1st','publication_year',1999,'location','CS-02'), @type_id, 'Joe Celko', '9781558604322', 1, 'DEMO-REAL'),
('Clean Code: A Handbook of Agile Software Craftsmanship', 'book', JSON_OBJECT('category','Computer Science','edition','2nd','publication_year',2025,'location','CS-03'), @type_id, 'Robert C. Martin', '9780135398548', 1, 'DEMO-REAL'),
('Computer Networking: A Top-Down Approach', 'book', JSON_OBJECT('category','Computer Science','edition','8th','publication_year',2021,'location','CS-03'), @type_id, 'James F. Kurose, Keith W. Ross', '9780136681557', 1, 'DEMO-REAL'),
('Introduction to Algorithms', 'book', JSON_OBJECT('category','Computer Science','edition','4th','publication_year',2022,'location','CS-04'), @type_id, 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein', '9780262046305', 1, 'DEMO-REAL'),
('Macroeconomics: Principles, Problems, and Policies', 'book', JSON_OBJECT('category','Business','edition','14th','publication_year',1999,'location','BUS-01'), @type_id, 'Campbell R. McConnell, Stanley L. Brue, Gerald C. Nelson', '9780073662930', 1, 'DEMO-REAL'),
('Pharmacology and the Nursing Process', 'book', JSON_OBJECT('category','Science','edition','8th','publication_year',2015,'location','SCI-01'), @type_id, 'Linda Lane Lilley, Shelly Rainforth Collins, Julie S. Snyder', '9780323358286', 1, 'DEMO-REAL'),
('The Sound and the Fury', 'book', JSON_OBJECT('category','Literature','edition','1st','publication_year',1991,'location','LIT-01'), @type_id, 'William Faulkner', '9780679732242', 1, 'DEMO-REAL'),
('Rounding the Mark', 'book', JSON_OBJECT('category','Literature','edition','1st','publication_year',2006,'location','LIT-02'), @type_id, 'Andrea Camilleri', '9780143037484', 1, 'DEMO-REAL');

-- 30 manga, all with real ISBN-13 values.
INSERT INTO books (title, material_type, metadata, book_type_id, author, isbn, copies, created_by) VALUES
('Naruto, Vol. 1: Uzumaki Naruto', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-01'), @type_id, 'Masashi Kishimoto', '9781569319000', 1, 'DEMO-REAL'),
('One Piece, Vol. 1: Romance Dawn', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-01'), @type_id, 'Eiichiro Oda', '9781569319017', 1, 'DEMO-REAL'),
('Bleach, Vol. 1: Strawberry and the Soul Reapers', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-02'), @type_id, 'Tite Kubo', '9781591164418', 1, 'DEMO-REAL'),
('Demon Slayer: Kimetsu no Yaiba, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-02'), @type_id, 'Koyoharu Gotouge', '9781974700523', 1, 'DEMO-REAL'),
('Jujutsu Kaisen, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-03'), @type_id, 'Gege Akutami', '9781974703180', 1, 'DEMO-REAL'),
('My Hero Academia, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-03'), @type_id, 'Kohei Horikoshi', '9781421582696', 1, 'DEMO-REAL'),
('Attack on Titan, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-04'), @type_id, 'Hajime Isayama', '9781612620244', 1, 'DEMO-REAL'),
('Spy x Family, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-04'), @type_id, 'Tatsuya Endo', '9781974715466', 1, 'DEMO-REAL'),
('Chainsaw Man, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-05'), @type_id, 'Tatsuki Fujimoto', '9781974709939', 1, 'DEMO-REAL'),
('Death Note, Vol. 1: Boredom', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-05'), @type_id, 'Tsugumi Ohba, Takeshi Obata', '9781421501680', 1, 'DEMO-REAL'),
('Fullmetal Alchemist, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-06'), @type_id, 'Hiromu Arakawa', '9781591169208', 1, 'DEMO-REAL'),
('Dragon Ball, Vol. 1: The Monkey King', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-06'), @type_id, 'Akira Toriyama', '9781569319208', 1, 'DEMO-REAL'),
('Tokyo Ghoul, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-07'), @type_id, 'Sui Ishida', '9781421580364', 1, 'DEMO-REAL'),
('Haikyu!!, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-07'), @type_id, 'Haruichi Furudate', '9781421587660', 1, 'DEMO-REAL'),
('Blue Lock, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-08'), @type_id, 'Muneyuki Kaneshiro, Yusuke Nomura', '9781646516544', 1, 'DEMO-REAL'),
('Kaiju No. 8, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-08'), @type_id, 'Naoya Matsumoto', '9781974725984', 1, 'DEMO-REAL'),
('Berserk, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-09'), @type_id, 'Kentaro Miura', '9781593070205', 1, 'DEMO-REAL'),
('Vinland Saga, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-09'), @type_id, 'Makoto Yukimura', '9781612624204', 1, 'DEMO-REAL'),
('JoJo''s Bizarre Adventure: Part 1—Phantom Blood, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-10'), @type_id, 'Hirohiko Araki', '9781421590646', 1, 'DEMO-REAL'),
('Komi Can''t Communicate, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-10'), @type_id, 'Tomohito Oda', '9781421596099', 1, 'DEMO-REAL'),
('Dr. STONE, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-11'), @type_id, 'Riichiro Inagaki, Boichi', '9781974702619', 1, 'DEMO-REAL'),
('Kaguya-sama: Love Is War, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-11'), @type_id, 'Aka Akasaka', '9781974700301', 1, 'DEMO-REAL'),
('Yona of the Dawn, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-12'), @type_id, 'Mizuho Kusanagi', '9781974712670', 1, 'DEMO-REAL'),
('Mashle: Magic and Muscles, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-12'), @type_id, 'Hajime Komoto', '9781974719297', 1, 'DEMO-REAL'),
('Dandadan, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-13'), @type_id, 'Yukinobu Tatsu', '9781974734634', 1, 'DEMO-REAL'),
('Black Clover, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-13'), @type_id, 'Yuki Tabata', '9781421587189', 1, 'DEMO-REAL'),
('One-Punch Man, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-14'), @type_id, 'ONE, Yusuke Murata', '9781421585642', 1, 'DEMO-REAL'),
('The Promised Neverland, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-14'), @type_id, 'Kaiu Shirai, Posuka Demizu', '9781421597126', 1, 'DEMO-REAL'),
('Frieren: Beyond Journey''s End, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-15'), @type_id, 'Kanehito Yamada, Tsukasa Abe', '9781974725762', 1, 'DEMO-REAL'),
('Sakamoto Days, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Manga','location','MANGA-15'), @type_id, 'Yuto Suzuki', '9781974728947', 1, 'DEMO-REAL');

-- 20 light novels, also real ISBN-bearing editions.
INSERT INTO books (title, material_type, metadata, book_type_id, author, isbn, copies, created_by) VALUES
('Sword Art Online, Vol. 1: Aincrad', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-01'), @type_id, 'Reki Kawahara', '9780316371247', 1, 'DEMO-REAL'),
('Re:ZERO -Starting Life in Another World-, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-01'), @type_id, 'Tappei Nagatsuki', '9780316398350', 1, 'DEMO-REAL'),
('Overlord, Vol. 1: The Undead King', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-02'), @type_id, 'Kugane Maruyama', '9780316397599', 1, 'DEMO-REAL'),
('That Time I Got Reincarnated as a Slime, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-02'), @type_id, 'Fuse', '9780316414203', 1, 'DEMO-REAL'),
('Konosuba: God''s Blessing on This Wonderful World!, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-03'), @type_id, 'Natsume Akatsuki', '9780316552561', 1, 'DEMO-REAL'),
('The Rising of the Shield Hero, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-03'), @type_id, 'Aneko Yusagi', '9781935548225', 1, 'DEMO-REAL'),
('Classroom of the Elite, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-04'), @type_id, 'Syougo Kinugasa', '9781642730012', 1, 'DEMO-REAL'),
('Spice and Wolf, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-04'), @type_id, 'Isuna Hasekura', '9780759531048', 1, 'DEMO-REAL'),
('The Melancholy of Haruhi Suzumiya', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-05'), @type_id, 'Nagaru Tanigawa', '9780316039024', 1, 'DEMO-REAL'),
('No Game No Life, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-05'), @type_id, 'Yuu Kamiya', '9780316383110', 1, 'DEMO-REAL'),
('86—Eighty-Six, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-06'), @type_id, 'Asato Asato', '9781975303129', 1, 'DEMO-REAL'),
('Mushoku Tensei: Jobless Reincarnation, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-06'), @type_id, 'Rifujin na Magonote', '9781642751383', 1, 'DEMO-REAL'),
('Ascendance of a Bookworm, Part 1: Daughter of a Soldier, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-07'), @type_id, 'Miya Kazuki', '9781718356009', 1, 'DEMO-REAL'),
('The Apothecary Diaries, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-07'), @type_id, 'Natsu Hyuuga', '9781646090709', 1, 'DEMO-REAL'),
('Rascal Does Not Dream of Bunny Girl Senpai', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-08'), @type_id, 'Hajime Kamoshida', '9781975399351', 1, 'DEMO-REAL'),
('The Angel Next Door Spoils Me Rotten, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-08'), @type_id, 'Saekisan', '9781975345648', 1, 'DEMO-REAL'),
('Is It Wrong to Try to Pick Up Girls in a Dungeon?, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-09'), @type_id, 'Fujino Omori', '9780316318181', 1, 'DEMO-REAL'),
('Log Horizon, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-09'), @type_id, 'Mamare Touno', '9780316382656', 1, 'DEMO-REAL'),
('Goblin Slayer, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-10'), @type_id, 'Kumo Kagyu', '9780316553230', 1, 'DEMO-REAL'),
('My Happy Marriage, Vol. 1', 'book', JSON_OBJECT('category','Literature','format','Light novel','location','LN-10'), @type_id, 'Akumi Agitogi', '9781975367411', 1, 'DEMO-REAL');

INSERT INTO book_copies (book_id, barcode, `condition`, is_active)
SELECT id, CONCAT('LIB-', LPAD(id, 6, '0'), '-001'), 'good', 1 FROM books WHERE created_by = 'DEMO-REAL';

-- Shared reading patterns: these five users overlap on the same real titles.
SELECT id INTO @naruto FROM books WHERE isbn = '9781569319000';
SELECT id INTO @one_piece FROM books WHERE isbn = '9781569319017';
SELECT id INTO @demon_slayer FROM books WHERE isbn = '9781974700523';
SELECT id INTO @attack FROM books WHERE isbn = '9781612620244';
SELECT id INTO @haikyu FROM books WHERE isbn = '9781421587660';
SELECT id INTO @blue_lock FROM books WHERE isbn = '9781646516544';
SELECT id INTO @sao FROM books WHERE isbn = '9780316371247';
SELECT id INTO @rezero FROM books WHERE isbn = '9780316398350';
SELECT id INTO @konosuba FROM books WHERE isbn = '9780316552561';
SELECT id INTO @apothecary FROM books WHERE isbn = '9781646090709';
SELECT id INTO @ddia FROM books WHERE isbn = '9781449373320';
SELECT id INTO @algorithms FROM books WHERE isbn = '9780262046305';
SELECT id INTO @clean_code FROM books WHERE isbn = '9780135398548';
SELECT id INTO @naruto_copy FROM book_copies WHERE book_id = @naruto LIMIT 1;
SELECT id INTO @demon_copy FROM book_copies WHERE book_id = @demon_slayer LIMIT 1;
SELECT id INTO @blue_copy FROM book_copies WHERE book_id = @blue_lock LIMIT 1;
SELECT id INTO @sao_copy FROM book_copies WHERE book_id = @sao LIMIT 1;
SELECT id INTO @apothecary_copy FROM book_copies WHERE book_id = @apothecary LIMIT 1;
SELECT id INTO @ddia_copy FROM book_copies WHERE book_id = @ddia LIMIT 1;
SELECT id INTO @clean_copy FROM book_copies WHERE book_id = @clean_code LIMIT 1;

INSERT INTO borrowings (user_id, book_id, copy_id, borrowed_at, due_date, returned_at, status, fine_per_hour, fine_interval, initial_fine, notes) VALUES
(@mika, @naruto, @naruto_copy, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), NULL, 'borrowed', 1.00, 'hour', 0.00, 'Current manga loan; Paolo is waiting'),
(@mika, @demon_slayer, @demon_copy, DATE_SUB(NOW(), INTERVAL 22 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 16 DAY), 'returned', 1.00, 'hour', 0.00, 'Completed manga loan'),
(@mika, @haikyu, (SELECT id FROM book_copies WHERE book_id = @haikyu LIMIT 1), DATE_SUB(NOW(), INTERVAL 38 DAY), DATE_SUB(NOW(), INTERVAL 31 DAY), DATE_SUB(NOW(), INTERVAL 31 DAY), 'returned', 1.00, 'hour', 0.00, 'Completed sports manga loan'),
(@paolo, @one_piece, (SELECT id FROM book_copies WHERE book_id = @one_piece LIMIT 1), DATE_SUB(NOW(), INTERVAL 31 DAY), DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY), 'returned', 1.00, 'hour', 0.00, 'Completed manga loan'),
(@paolo, @blue_lock, @blue_copy, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), NULL, 'overdue', 1.00, 'hour', 0.00, 'Overdue circulation scenario'),
(@lea, @sao, @sao_copy, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_ADD(NOW(), INTERVAL 3 DAY), NULL, 'borrowed', 1.00, 'hour', 0.00, 'Current light novel loan'),
(@lea, @konosuba, (SELECT id FROM book_copies WHERE book_id = @konosuba LIMIT 1), DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY), 'returned', 1.00, 'hour', 0.00, 'Completed light novel loan'),
(@andre, @apothecary, @apothecary_copy, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 6 DAY), NULL, 'borrowed', 1.00, 'hour', 0.00, 'Current light novel loan'),
(@andre, @ddia, @ddia_copy, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 13 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY), 'returned', 1.00, 'hour', 0.00, 'Completed computing loan'),
(@andre, @clean_code, @clean_copy, DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), NULL, 'borrowed', 1.00, 'hour', 0.00, 'Current computing loan');

INSERT INTO reservations (user_id, book_id, reserved_copy_id, status, reserved_at, expires_at, fulfilled_at, cancelled_at, notes) VALUES
(@paolo, @naruto, NULL, 'pending', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, NULL, NULL, 'Waiting for Mika''s Naruto copy'),
(@mika, @one_piece, NULL, 'fulfilled', DATE_SUB(NOW(), INTERVAL 30 DAY), NULL, DATE_SUB(NOW(), INTERVAL 29 DAY), NULL, 'Previously collected after Paolo returned it'),
(@andre, @attack, NULL, 'pending', DATE_SUB(NOW(), INTERVAL 2 DAY), NULL, NULL, NULL, 'Waiting list scenario'),
(@lea, @rezero, NULL, 'fulfilled', DATE_SUB(NOW(), INTERVAL 12 DAY), NULL, DATE_SUB(NOW(), INTERVAL 11 DAY), NULL, 'Recent light novel reservation'),
(@mika, @algorithms, NULL, 'cancelled', DATE_SUB(NOW(), INTERVAL 16 DAY), NULL, NULL, DATE_SUB(NOW(), INTERVAL 15 DAY), 'Changed reading plan'),
(@paolo, @demon_slayer, NULL, 'expired', DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY), NULL, NULL, 'Expired pickup scenario');

INSERT INTO recommendation_feedback (user_id, book_id, feedback) VALUES
(@mika, @rezero, 'dismissed'),
(@paolo, @sao, 'dismissed'),
(@lea, @blue_lock, 'dismissed');

INSERT INTO book_embeddings (book_id, model, content_hash, status)
SELECT id, 'gemini-embedding-001', '', 'stale' FROM books WHERE created_by = 'DEMO-REAL';
INSERT INTO book_enrichment (book_id, source, status)
SELECT id, 'none', 'stale' FROM books WHERE created_by = 'DEMO-REAL';

INSERT INTO attendance_logs (user_id, scanned_id, type, purpose, created_at) VALUES
(@mika, 'DEMO-REAL-001', 'check_in', 'entry_exit', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@mika, 'DEMO-REAL-001', 'check_out', 'entry_exit', DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 3 HOUR),
(@paolo, 'DEMO-REAL-002', 'check_in', 'entry_exit', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@lea, 'DEMO-REAL-003', 'check_in', 'entry_exit', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(@andre, 'DEMO-REAL-004', 'check_in', 'entry_exit', DATE_SUB(NOW(), INTERVAL 1 DAY));
INSERT INTO notifications (type, title, body, href, audience_type, audience_user_id, source_type) VALUES
('reservation_pending', 'Reservation pending', 'Naruto will be available after the active loan is returned.', '/my-library', 'user', @paolo, 'demo_seed'),
('overdue', 'Book overdue', 'Blue Lock is overdue. Please return or renew it.', '/my-library', 'user', @paolo, 'demo_seed'),
('announcement', 'Real-catalogue demo loaded', 'Sign in with a demo student to explore shared circulation and recommendation behavior.', '/catalogue', 'role', NULL, 'demo_seed');

COMMIT;

-- Quick checks:
-- SELECT name, title, status FROM borrowings JOIN users ON users.id = borrowings.user_id JOIN books ON books.id = borrowings.book_id WHERE books.created_by = 'DEMO-REAL';
-- SELECT name, title, status FROM reservations JOIN users ON users.id = reservations.user_id JOIN books ON books.id = reservations.book_id WHERE books.created_by = 'DEMO-REAL';
