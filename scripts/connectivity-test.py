import socket

def is_udp_port_reachable(host, port, timeout=2):
    """
    Check if a UDP port is reachable.

    Args:
        host (str): The target hostname or IP address.
        port (int): The target UDP port.
        timeout (int): Timeout in seconds for the operation.

    Returns:
        bool: True if the port is reachable, False otherwise.
    """
    try:
        # Create a UDP socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)

        # Send a dummy packet
        sock.sendto(b"", (host, port))

        # Try to receive a response
        sock.recvfrom(1024)
        return True
    except socket.timeout:
        # No response received within the timeout
        return False
    except socket.error:
        # Other socket errors
        return False
    finally:
        sock.close()

# Example usage
host = "3.68.198.199"
port = 2458
if is_udp_port_reachable(host, port):
    print(f"UDP port {port} on {host} is reachable.")
else:
    print(f"UDP port {port} on {host} is not reachable.")
