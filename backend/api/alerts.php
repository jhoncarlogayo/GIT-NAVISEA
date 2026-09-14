<?php
require_once '../config/cors.php';
require_once '../config/db.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $severity = $_GET['severity'] ?? null;
    $sql = "SELECT a.*, v.name AS vessel_name FROM alerts a
            LEFT JOIN vessels v ON a.vessel_id = v.id";
    if ($severity) $sql .= " WHERE a.severity = '" . $db->real_escape_string($severity) . "'";
    $sql .= " ORDER BY a.created_at DESC LIMIT 100";
    $result = $db->query($sql);
    $alerts = [];
    while ($row = $result->fetch_assoc()) $alerts[] = $row;
    echo json_encode($alerts);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (($data['action'] ?? '') === 'acknowledge') {
        $id = (int)$data['id'];
        $db->query("UPDATE alerts SET acknowledged = 1 WHERE id = $id");
        echo json_encode(['success' => true]);
        exit;
    }

    $stmt = $db->prepare(
        "INSERT INTO alerts (vessel_id, alert_type, severity, latitude, longitude, message)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param('issdds',
        $data['vessel_id'], $data['alert_type'], $data['severity'],
        $data['latitude'], $data['longitude'], $data['message']
    );
    $stmt->execute();
    echo json_encode(['success' => true, 'id' => $db->insert_id]);
}
