<?php
require_once '../config/cors.php';
require_once '../config/db.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// GET — list all vessels with latest sensor data
if ($method === 'GET') {
    $result = $db->query("
        SELECT v.*,
               s.temperature, s.battery_level, s.recorded_at AS last_sensor_time
        FROM vessels v
        LEFT JOIN sensor_data s ON s.id = (
            SELECT id FROM sensor_data WHERE vessel_id = v.id ORDER BY recorded_at DESC LIMIT 1
        )
        ORDER BY v.updated_at DESC
    ");
    $vessels = [];
    while ($row = $result->fetch_assoc()) $vessels[] = $row;
    echo json_encode($vessels);
    exit;
}

// POST — add new vessel
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // DELETE action via POST body
    if (($data['action'] ?? '') === 'delete') {
        $id = (int)$data['id'];
        $db->query("DELETE FROM vessels WHERE id = $id");
        echo json_encode(['success' => true]);
        exit;
    }

    // Validate required fields
    if (empty($data['name']) || empty($data['mmsi'])) {
        http_response_code(400);
        echo json_encode(['error' => 'name and mmsi are required']);
        exit;
    }

    $stmt = $db->prepare(
        "INSERT INTO vessels (name, mmsi, type, latitude, longitude, speed, heading, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), type=VALUES(type),
           latitude=VALUES(latitude), longitude=VALUES(longitude),
           speed=VALUES(speed), heading=VALUES(heading),
           status=VALUES(status), updated_at=NOW()"
    );
    $stmt->bind_param('sssdddds',
        $data['name'],
        $data['mmsi'],
        $data['type']      ?? 'unknown',
        $data['latitude']  ?? 0,
        $data['longitude'] ?? 0,
        $data['speed']     ?? 0,
        $data['heading']   ?? 0,
        $data['status']    ?? 'inactive'
    );

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'id' => $db->insert_id ?: $data['mmsi']]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    exit;
}
