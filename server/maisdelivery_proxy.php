<?php
/* Adaptador mínimo para hospedagem PHP existente. Não inclui credenciais.
   Instalar em HTTPS; apenas operações 9/10 do sandbox podem passar por ele. */
declare(strict_types=1);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$origins = ['https://pixmcp-cloud.github.io', 'https://batata.livresom.com'];
if ($origin !== '' && !in_array($origin, $origins, true)) {
    http_response_code(403);
    exit;
}
if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}
$raw = file_get_contents('php://input');
if (!is_string($raw) || strlen($raw) > 20000) {
    http_response_code(413);
    echo json_encode(['error' => 'Requisição muito grande']);
    exit;
}
$input = json_decode($raw, true);
$payload = $input['request'] ?? null;
$token = trim((string)($input['accessToken'] ?? ''));
$basic = preg_replace('/^Basic\s+/i', '', trim((string)($input['basicAuth'] ?? '')));
$ids = is_array($payload) ? [$payload['idEmpresaIntegrada'] ?? null, $payload['idRestaurante'] ?? null, $payload['idOrigem'] ?? null] : [];
$validIds = count($ids) === 3 && count(array_filter($ids, fn($v) => is_int($v) && $v > 0)) === 3;
$products = is_array($payload) ? ($payload['produtos'] ?? null) : null;
if (!is_array($payload) || ($payload['sandBox'] ?? null) !== true ||
    !in_array($payload['nrOperacao'] ?? null, [9, 10], true) || !$validIds ||
    !is_array($products) || count($products) < 1 || count($products) > 30 ||
    strlen($token) < 16 || strlen($token) > 3000 ||
    strlen($basic) < 10 || strlen($basic) > 3000) {
    http_response_code(400);
    echo json_encode(['error' => 'Parâmetros de sandbox ou credenciais inválidos']);
    exit;
}
if (!function_exists('curl_init')) {
    http_response_code(503);
    echo json_encode(['error' => 'Extensão cURL não disponível na hospedagem']);
    exit;
}
$ch = curl_init('https://maisdeliveryapp.com.br/oapi/v2/controller/operacao_oapi_v2_publica.php');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => [
        'Accesstoken: ' . $token,
        'Authorization: Basic ' . $basic,
        'Content-Type: application/x-www-form-urlencoded'
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_SSL_VERIFYPEER => true
]);
$result = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);
if ($result === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Falha de comunicação com MaisDelivery', 'detail' => substr($error, 0, 200)]);
    exit;
}
http_response_code($status >= 400 && $status < 600 ? $status : 200);
$decoded = json_decode($result, true);
echo json_encode(['sandbox' => true, 'httpStatus' => $status, 'response' => $decoded ?? substr((string)$result, 0, 2000)],
                 JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
