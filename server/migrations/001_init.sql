-- Ipak Yo'li sarguzashti: boshlang'ich sxema.
-- Bolalar haqida faqat ism, sinf (classes.grade) va maktab saqlanadi. Telefon/manzil/familiya maydoni yo'q.

CREATE TABLE schools (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role           text NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  email          text UNIQUE,              -- faqat o'qituvchi/admin
  password_hash  text,                     -- faqat o'qituvchi/admin
  class_id       integer,                  -- faqat o'quvchi
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz,
  CHECK ((role = 'student') = (class_id IS NOT NULL)),
  CHECK ((role = 'student') = (email IS NULL))
);

CREATE TABLE classes (
  id               serial PRIMARY KEY,
  school_id        integer NOT NULL REFERENCES schools(id),
  teacher_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 30),
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 11),
  code             text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$'),
  ranking_enabled  boolean NOT NULL DEFAULT false,
  -- 7-14 yoshlilar (1-8 sinf) uchun ommaviy reyting yo'q
  CHECK (NOT ranking_enabled OR grade >= 9),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD CONSTRAINT users_class_fk FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX users_class_name_uniq ON users (class_id, lower(name)) WHERE role = 'student';

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- O'quvchining to'liq holati (birlashtirilgan JSON hujjat) — sinxronlash manbai.
CREATE TABLE student_state (
  student_id  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  doc         jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Statistika uchun jadvallar (student_state'dan har saqlashda yangilanadi).
CREATE TABLE progress (
  student_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id        text NOT NULL,
  stars          smallint NOT NULL CHECK (stars BETWEEN 1 AND 3),
  attempts       integer NOT NULL CHECK (attempts >= 1),
  best_mistakes  integer NOT NULL CHECK (best_mistakes >= 0),
  best_time_ms   integer,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, task_id)
);

CREATE TABLE inventory (
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  part_id     text NOT NULL,
  PRIMARY KEY (student_id, item_id, part_id)
);

-- Avatar do'koni keyingi versiyada; jadval rejadagi sxemaga muvofiq oldindan yaratilgan.
CREATE TABLE avatar_items (
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, item_id)
);
