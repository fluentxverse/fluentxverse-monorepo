# Video call infrastructure

Lesson and interview calls use peer-to-peer WebRTC. The server authorizes room
membership and relays signaling; it does not relay audio or video.

For reliable calls across restrictive NATs and firewalls, provision a TURN
service (for example, coturn with `use-auth-secret`) and set these on the API
and Socket.IO server:

```env
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:443?transport=tcp
TURN_SHARED_SECRET=<same secret configured on the TURN server>
```

The server issues temporary HMAC credentials over the authenticated Socket.IO
connection. Do not put the shared secret in a frontend build variable. Expose
UDP and TCP TURN ports and a reachable relay port range on the TURN host. A
TLS TURN listener on port 443 is recommended for networks that block UDP and
port 3478. Confirm that the chosen TURN URLs and relay addresses are reachable
from outside the server network; a private Docker address will not work.

With no TURN settings, the apps use STUN and calls can fail on restricted
networks. Validate the production setup with two browsers on different networks,
including a network that blocks UDP, and inspect `webrtc-internals` for a
selected `relay` candidate pair.
