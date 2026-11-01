-- Схема БД "Котики-терапевты на выезд".
-- Скрипт идемпотентен: удаляет таблицы, создает их заново и заливает демо-данные.
-- Запуск: psql -d cat_therapy -f server/db/schema.sql

DROP TABLE IF EXISTS reviews, order_items, orders, order_statuses, cart_items,
service_cats, services, cats, categories, password_resets, users, roles CASCADE;

-- Роли - справочник, администратор его не меняет
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role_id INT NOT NULL REFERENCES roles (id),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    default_address VARCHAR(255),
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Одноразовые коды восстановления пароля (хранится только хеш)
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash CHAR(64) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500)
);

-- "Сотрудники"-коты
CREATE TABLE cats (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    breed VARCHAR(100),
    age_years INT CHECK (age_years BETWEEN 0 AND 30),
    photo_url VARCHAR(500),
    description VARCHAR(1000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL UNIQUE,
    description VARCHAR(2000) NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 15 AND 1440),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Какие коты работают на какой услуге (многие-ко-многим)
CREATE TABLE service_cats (
    service_id INT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    cat_id INT NOT NULL REFERENCES cats (id) ON DELETE CASCADE,
    PRIMARY KEY (service_id, cat_id)
);

-- Корзина хранится в БД и привязана к пользователю
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    service_id INT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, service_id)
);

-- Статусы заказа - справочник
CREATE TABLE order_statuses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    sort_order INT NOT NULL
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status_id INT NOT NULL REFERENCES order_statuses (id),
    delivery_address VARCHAR(255) NOT NULL,
    delivery_date DATE NOT NULL,
    comment VARCHAR(500),
    total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Позиции заказа: название и цена сохраняются "снимком", чтобы история
-- не менялась при редактировании или удалении услуги
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    service_id INT REFERENCES services (id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 1)
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    service_id INT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, service_id)
);

CREATE INDEX idx_services_category ON services (category_id);
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_reviews_service ON reviews (service_id);
CREATE INDEX idx_password_resets_user ON password_resets (user_id);

-- Справочные данные
INSERT INTO roles (code, name)
VALUES
('admin', 'Администратор'),
('user', 'Пользователь');

INSERT INTO order_statuses (code, name, sort_order)
VALUES
('new', 'Новый', 1),
('confirmed', 'Подтвержден', 2),
('in_progress', 'Котики в пути', 3),
('completed', 'Выполнен', 4),
('cancelled', 'Отменен', 5);

-- Демо-данные
-- Пароли (bcrypt): admin@cats.local / Admin12345 (админ) и user@cats.local / User12345
INSERT INTO users (role_id, full_name, email, phone, password_hash, default_address)
VALUES
((SELECT id FROM roles WHERE code = 'admin'), 'Мурлыкина Анна Сергеевна', 'admin@cats.local', '+7 (900) 000-00-01',
 '$2b$10$NjB3Ovaazesj6zxykrnezePGH3UGb8hs/ks8l.Qz2FiY.bJ4tXudC', NULL),
((SELECT id FROM roles WHERE code = 'user'), 'Иванов Иван Иванович', 'user@cats.local', '+7 (900) 000-00-02',
 '$2b$10$TSjnYGK6jwzgEyhDQ93ECO5BEmwGBZO9hlay17wmZdAIKi3Pu/yLm', 'г. Москва, ул. Тверская, д. 1, оф. 10');

INSERT INTO categories (slug, name, description)
VALUES
('office', 'Для офиса', 'Котики приезжают в офис и снимают стресс у всей команды'),
('home', 'На дом', 'Индивидуальные визиты котиков к вам домой'),
('students', 'Студентам', 'Антистресс перед сессией и экзаменами'),
('events', 'Мероприятия', 'Котики на праздниках, тимбилдингах и выставках');

INSERT INTO cats (name, breed, age_years, photo_url, description)
VALUES
('Барсик', 'Британская короткошёрстная', 5, 'https://placecats.com/barsik/400/300', 'Флегматичный и очень терпеливый. Любит, когда его гладят на совещаниях.'),
('Мурка', 'Мейн-кун', 4, 'https://placecats.com/murka/400/300', 'Огромная и пушистая. Мурчит на частоте, снижающей тревожность.'),
('Пушок', 'Рэгдолл', 3, 'https://placecats.com/pushok/400/300', 'Обмякает на руках — идеален для объятий.'),
('Тимофей', 'Сибирская', 7, 'https://placecats.com/timofey/400/300', 'Опытный терапевт, работает с большими группами.'),
('Соня', 'Шотландская вислоухая', 2, 'https://placecats.com/sonya/400/300', 'Спокойная, любит спать на коленях у студентов.');

INSERT INTO services (category_id, title, description, duration_minutes, price)
VALUES
((SELECT id FROM categories WHERE slug = 'office'), 'Кото-перерыв для офиса, 1 ч',
 'Куратор привозит двух спокойных котиков в ваш офис. Час мурчания вместо кофе-брейка.', 60, 4500),
((SELECT id FROM categories WHERE slug = 'office'), 'Кото-день для команды, 4 ч',
 'Котики проводят с командой половину рабочего дня. Подходит для офисов до 40 человек.', 240, 14000),
((SELECT id FROM categories WHERE slug = 'students'), 'Антистресс перед сессией, 2 ч',
 'Два часа с котиками для группы студентов перед экзаменами. Чай и печенье включены.', 120, 5000),
((SELECT id FROM categories WHERE slug = 'home'), 'Домашний визит, 1 ч',
 'Индивидуальный визит котика-терапевта к вам домой.', 60, 3000),
((SELECT id FROM categories WHERE slug = 'home'), 'Вечер с котиком, 3 ч',
 'Спокойный вечер дома в компании котика. Куратор остаётся рядом.', 180, 7500),
((SELECT id FROM categories WHERE slug = 'events'), 'Котики на празднике, 2 ч',
 'Три котика и куратор на вашем мероприятии: день рождения, тимбилдинг, выставка.', 120, 9000);

INSERT INTO service_cats (service_id, cat_id)
SELECT s.id, c.id
FROM services s
JOIN cats c ON (s.title, c.name) IN (
    ('Кото-перерыв для офиса, 1 ч', 'Барсик'), ('Кото-перерыв для офиса, 1 ч', 'Тимофей'),
    ('Кото-день для команды, 4 ч', 'Тимофей'), ('Кото-день для команды, 4 ч', 'Мурка'),
    ('Антистресс перед сессией, 2 ч', 'Соня'), ('Антистресс перед сессией, 2 ч', 'Пушок'),
    ('Домашний визит, 1 ч', 'Пушок'), ('Вечер с котиком, 3 ч', 'Мурка'),
    ('Котики на празднике, 2 ч', 'Барсик'), ('Котики на празднике, 2 ч', 'Мурка'),
    ('Котики на празднике, 2 ч', 'Тимофей')
);

INSERT INTO reviews (user_id, service_id, rating, comment)
SELECT u.id, s.id, 5, 'Барсик проспал всю планёрку у меня на коленях. Лучший созвон в моей жизни!'
FROM users u, services s
WHERE u.email = 'user@cats.local' AND s.title = 'Кото-перерыв для офиса, 1 ч';
