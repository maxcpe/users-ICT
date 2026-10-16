# ค่าร่วมของ location /users — วางไว้โฟลเดอร์เดียวกับ nginx.conf (conf\users-proxy.inc)
proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;

# cookie ของการล็อกอิน Microsoft 365 ใหญ่ ถ้า buffer เล็กจะได้ 502 "upstream sent too big header"
proxy_buffer_size       32k;
proxy_buffers           8 32k;
proxy_busy_buffers_size 64k;

proxy_read_timeout  60s;
client_max_body_size 2m;
