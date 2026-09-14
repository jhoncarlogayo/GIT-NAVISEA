-- NaviSea Database Schema
CREATE DATABASE IF NOT EXISTS navisea;
USE navisea;

CREATE TABLE vessels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mmsi VARCHAR(20) UNIQUE NOT NULL,
    type ENUM('fishing','cargo','patrol','unknown') DEFAULT 'unknown',
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    speed DECIMAL(5,2) DEFAULT 0,
    heading DECIMAL(5,2) DEFAULT 0,
    status ENUM('active','inactive','alert') DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vessel_id INT,
    alert_type ENUM('border_breach','speed_violation','unauthorized_zone','sos','signal_loss') NOT NULL,
    severity ENUM('info','warning','critical') DEFAULT 'warning',
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    message TEXT,
    acknowledged TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE SET NULL
);

CREATE TABLE sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vessel_id INT,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    speed DECIMAL(5,2),
    heading DECIMAL(5,2),
    temperature DECIMAL(5,2),
    battery_level DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE
);

CREATE TABLE api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_value VARCHAR(64) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data
INSERT INTO vessels (name, mmsi, type, latitude, longitude, speed, status) VALUES
('MV Coastal Star', '419000001', 'fishing', 9.2, 79.8, 5.2, 'active'),
('MV Sea Guardian', '419000002', 'patrol', 9.9, 80.1, 12.0, 'alert'),
('MV Blue Horizon', '419000003', 'cargo', 8.5, 80.5, 8.7, 'active');

INSERT INTO api_keys (key_value, device_name) VALUES
('navisea_iot_key_001', 'IoT Buoy Node 1'),
('navisea_iot_key_002', 'IoT Buoy Node 2');
