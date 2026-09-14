<?php
// Auto-setup: run this once at http://localhost/navicap/backend/api/setup.php
require_once '../config/db.php';

$db = new mysqli(DB_HOST, DB_USER, DB_PASS);
if ($db->connect_error) die(json_encode(['error' => $db->connect_error]));

$sqls = [
    "CREATE DATABASE IF NOT EXISTS navisea",
    "USE navisea",
    "CREATE TABLE IF NOT EXISTS vessels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        mmsi VARCHAR(20) UNIQUE NOT NULL,
        type ENUM('fishing','cargo','patrol','unknown') DEFAULT 'unknown',
        latitude DECIMAL(10,7) DEFAULT 0,
        longitude DECIMAL(10,7) DEFAULT 0,
        speed DECIMAL(5,2) DEFAULT 0,
        heading DECIMAL(5,2) DEFAULT 0,
        status ENUM('active','inactive','alert') DEFAULT 'inactive',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS alerts (
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
    )",
    "CREATE TABLE IF NOT EXISTS sensor_data (
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
    )",
    "CREATE TABLE IF NOT EXISTS api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        key_value VARCHAR(64) UNIQUE NOT NULL,
        device_name VARCHAR(100),
        active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "INSERT IGNORE INTO vessels (name, mmsi, type, latitude, longitude, speed, heading, status) VALUES
        ('MV Coastal Star', '419000001', 'fishing', 9.2000000, 79.8000000, 5.20, 90, 'active'),
        ('MV Sea Guardian', '419000002', 'patrol',  9.9000000, 80.1000000, 12.00, 180, 'alert'),
        ('MV Blue Horizon', '419000003', 'cargo',   8.5000000, 80.5000000, 8.70, 270, 'active')",
    "INSERT IGNORE INTO api_keys (key_value, device_name) VALUES
        ('navisea_iot_key_001', 'IoT Buoy Node 1'),
        ('navisea_iot_key_002', 'IoT Buoy Node 2')",
    "INSERT IGNORE INTO alerts (vessel_id, alert_type, severity, latitude, longitude, message) VALUES
        (2, 'border_breach', 'critical', 9.9, 80.1, 'Vessel crossed maritime border'),
        (1, 'speed_violation', 'warning', 9.2, 79.8, 'Speed limit exceeded in restricted zone')"
];

header('Content-Type: application/json');
$results = [];
foreach ($sqls as $sql) {
    if (!$db->query($sql)) {
        $results[] = ['sql' => substr($sql, 0, 60), 'error' => $db->error];
    } else {
        $results[] = ['sql' => substr($sql, 0, 60), 'ok' => true];
    }
}

echo json_encode(['setup' => 'complete', 'results' => $results], JSON_PRETTY_PRINT);
