CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tasks (title, description, status) VALUES
('Complete Docker Lab', 'Implement the three-tier architecture with Docker Compose', 'in-progress'),
('Learn Multi-stage Builds', 'Study how to optimize Dockerfiles for size and security', 'pending'),
('Configure Networks', 'Isolate database and backend from direct public access', 'pending');
