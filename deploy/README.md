# deploy ระบบจัดการผู้ใช้ขึ้น SVR-ICT-SERVICE

ภาพรวม: push ขึ้น `main` → GitHub Actions สั่ง self-hosted runner บนเซิร์ฟเวอร์ → lint, typecheck, test, build → `deploy\deploy.ps1` คัดลอกไป `C:\Web\users\releases\…` สลับ `current` แล้วรีสตาร์ต service `users` (NSSM) ที่พอร์ต 3006 → nginx ส่ง `/users` มาที่พอร์ตนี้

```
C:\Web\users\
  .env          ค่าจริง (สร้างเอง ไม่อยู่ใน git)
  current\      junction ชี้เวอร์ชันที่ใช้อยู่
  releases\     เก็บ 5 เวอร์ชันล่าสุด
  logs\         out.log / error.log
C:\actions-runner\users\   GitHub runner
```

ทุกคำสั่งด้านล่างรันใน PowerShell แบบ **Run as administrator** บนเซิร์ฟเวอร์

## ตั้งค่าครั้งแรก

### 1. ของที่ต้องมีบนเครื่อง
- Node.js 22 LTS (`node -v`) และ Git (`git --version`)
- NSSM (ใช้ตัวเดียวกับระบบประเมิน)
- พอร์ต 3006 ว่าง: `Get-NetTCPConnection -LocalPort 3006 -State Listen` ต้องไม่มีผล

### 2. สร้าง `C:\Web\users\.env`
คัดลอกจาก `.env.example` แล้วใส่ค่าจริง ค่าที่ต่างจากเครื่องพัฒนา:

```
DATABASE_URL=mysql://ictservice:<รหัสผ่าน>@127.0.0.1:3306/user
AUTH_SECRET=<สุ่มใหม่ ไม่ใช้ตัวเดียวกับเครื่องพัฒนา: npx auth secret>
AUTH_URL=https://service.ict.up.ac.th/users/api/auth
AUTH_TRUST_HOST=true
AUTH_MICROSOFT_ENTRA_ID_ID=<Application (client) ID>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Client Secret>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<Tenant ID>/v2.0
IDCARD_HMAC_KEY=<คีย์เดียวกับระบบลงทะเบียน>
TZ=Asia/Bangkok
```

ห้ามใส่ `USER_DB_READONLY` หรือ `ALLOW_PRODUCTION_WRITES` (ใช้ได้เฉพาะเครื่องพัฒนา แอปจะไม่ยอมเริ่ม)
รหัสผ่านที่มี `@ : / #` ต้องเข้ารหัส URL เช่น `@` → `%40`

### 3. Entra ID
ในแอปที่ลงทะเบียนไว้ → Authentication → เพิ่ม Redirect URI (Web):
`https://service.ict.up.ac.th/users/api/auth/callback/microsoft-entra-id`

### 4. ติดตั้ง service (ครั้งเดียว)
```
git clone https://github.com/maxcpe/users-ICT.git C:\temp\users-ICT
cd C:\temp\users-ICT
.\deploy\install-service.ps1 -Nssm 'C:\path\to\nssm.exe'
```
สคริปต์จะจำกัดสิทธิ์ `.env` ให้อ่านได้เฉพาะ Administrators และ SYSTEM

### 5. nginx
ไฟล์ `C:\nginx-1.30.2\conf\nginx.conf` (nginx รันเป็น NSSM service ชื่อ `nginx`)
1. สำรองไฟล์ก่อน แล้ววางเนื้อหา `deploy\nginx-users.conf` ใน `server { listen 443 ssl; … }` ของ service.ict.up.ac.th ต่อจาก location ของ `/evaluation/` ก่อน `location /api_ict/`
2. `cd C:\nginx-1.30.2` → `.\nginx.exe -t` ต้องผ่านก่อน
3. `Restart-Service nginx` — `nginx -s reload` ใช้ไม่ได้ (Access is denied) เพราะ service รันด้วยบัญชี SYSTEM ทุกเว็บสะดุดประมาณ 1 วินาที

`C:\Web` เป็น root ของ nginx — สอง location นี้ทำให้ทุก path ใต้ `/users` ไปที่แอป ไม่ใช่ไฟล์ในโฟลเดอร์ (ไม่งั้น `.env` อาจถูกเปิดอ่านได้) ห้ามลบออกโดยไม่ย้ายโฟลเดอร์แอป

### 6. GitHub runner
GitHub → repo `users-ICT` → Settings → Actions → Runners → New self-hosted runner → Windows x64 ทำตามคำสั่งที่หน้านั้นให้ แต่ติดตั้งที่ `C:\actions-runner\users` และตอน `config.cmd`:

- labels: กด Enter ข้ามได้ (workflow ใช้ `self-hosted, Windows` เพราะ repo นี้มี runner ตัวเดียว)
- Run as service: **Y**
- บัญชีของ service: ใส่ `NT AUTHORITY\SYSTEM` — ต้องหยุด/เริ่ม service `users` และอ่าน `.env` ได้ (บัญชีปริยาย NETWORK SERVICE ทำไม่ได้)

ตรวจว่า runner ใช้ `node` และ `git` ได้: ถ้าติดตั้ง Node หลัง runner ให้รีสตาร์ต service ของ runner

### 7. deploy ครั้งแรก
GitHub → Actions → deploy → Run workflow (หรือ push ขึ้น `main`) แล้วเปิด https://service.ict.up.ac.th/users

## ใช้งานประจำ
- **deploy**: push ขึ้น `main` เท่านั้น ใช้เวลาประมาณ 3–5 นาที ถ้า lint/test ไม่ผ่านจะไม่ deploy
- **เวอร์ชันใหม่เปิดไม่ขึ้น**: สคริปต์ย้อนกลับเวอร์ชันเดิมให้เอง ดูสาเหตุที่ `C:\Web\users\logs\error.log`
- **ย้อนเวอร์ชันเอง**:
  ```
  Stop-Service users
  cmd /c rmdir C:\Web\users\current
  New-Item -ItemType Junction -Path C:\Web\users\current -Target C:\Web\users\releases\<ชื่อเวอร์ชัน>
  Start-Service users
  ```
- **แก้ `.env`**: แก้ที่ `C:\Web\users\.env` แล้ว deploy ใหม่ (Run workflow) — สำเนาในแต่ละเวอร์ชันจะไม่เปลี่ยนเอง
- **ดู log**: `Get-Content C:\Web\users\logs\error.log -Tail 50`
- **migration ของฐาน**: deploy ไม่รันให้ (ฐานไม่ว่าง ใช้ `migrate deploy` ไม่ได้) ถ้ามีโฟลเดอร์ใหม่ใน `prisma/migrations` ให้รัน SQL เองแล้ว `npx prisma migrate resolve --applied <ชื่อ>` ก่อน push
