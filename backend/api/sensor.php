<?php
require_once '../config/cors.php';
require_once '../config/db.php';

// IoT devices POST sensor readings here
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$db = getDB();

// Validate API key
$key = $db->real_escape_string($data['api_key'] ?? '');
$check = $db->query("SELECT id FROM api_keys WHERE key_value='$key' AND active=1");
if ($check->num_rows === 0) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid API key']);
    exit;
}

// Store sensor reading
$stmt = $db->prepare(
    "INSERT INTO sensor_data (vessel_id, latitude, longitude, speed, heading, temperature, battery_level)
     VALUES (?, ?, ?, ?, ?, ?, ?)"
);
$stmt->bind_param('idddddd',
    $data['vessel_id'], $data['latitude'], $data['longitude'],
    $data['speed'], $data['heading'],
    $data['temperature'] ?? null, $data['battery_level'] ?? null
);
$stmt->execute();

// Update vessel position
$db->query("UPDATE vessels SET latitude={$data['latitude']}, longitude={$data['longitude']},
            speed={$data['speed']}, heading={$data['heading']}, updated_at=NOW()
            WHERE id={$data['vessel_id']}");

// Border breach check (example: lat > 9.8 triggers alert)
if ($data['latitude'] > 9.8) {
    $vid = (int)$data['vessel_id'];
    $lat = (float)$data['latitude'];
    $lon = (float)$data['longitude'];
    $db->query("INSERT INTO alerts (vessel_id, alert_type, severity, latitude, longitude, message)
                VALUES ($vid, 'border_breach', 'critical', $lat, $lon, 'Vessel crossed maritime border')");
}

echo json_encode(['success' => true]);
