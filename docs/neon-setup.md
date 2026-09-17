# Neon 管理員登入設定

本專案的正式登入採用 Vercel Functions 加上 Neon PostgreSQL。帳密、Session 與稽核紀錄都由後端處理；沒有 Email、電話、公開註冊或忘記密碼頁面。請先完成以下設定，再部署含登入功能的版本，避免現有網站被未設定的登入 API 影響。

## 1. 建立 Neon 免費專案

1. 前往 https://console.neon.tech，以 Google 帳號登入或建立 Neon 帳號。Free 方案可先使用，通常不需綁定信用卡；這個 Google 帳號只用來管理 Neon，不會成為本系統的管理員登入帳號。
2. 建立專案，名稱可用 rat-monitor；區域選離台灣最近的亞洲區域。
3. 在 Neon 的 SQL Editor 開啟 docs/neon-auth-schema.sql，完整貼上並執行一次。
4. 在 Neon Dashboard 的 Connect 頁取得 Pooled connection string。這是機密，不能貼到聊天室、GitHub 或任何 VITE_ 開頭的變數。

## 2. 僅設定 Vercel 正式環境

在 Vercel 專案 rat-monitor 的 Settings → Environment Variables，先只新增到 Production：

| 名稱 | 值 |
| --- | --- |
| DATABASE_URL | Neon 的 Pooled connection string |
| APP_ORIGIN | https://rat-monitor.vercel.app |
| SESSION_TOKEN_PEPPER | 32 bytes 以上的隨機 base64url 字串 |
| AUTH_FINGERPRINT_KEY | 32 bytes 以上的另一組隨機 base64url 字串 |

APP_ORIGIN 必須是正式站的完整網址且沒有結尾斜線；若之後改用自訂網域，也要一併更新。不要將這些變數加到 Preview，因為 Preview 網址不同，來源驗證會正確地拒絕它。

在本機產生兩組隨機值時，可執行兩次以下指令，再把每次輸出分別貼入 Vercel：

~~~
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
~~~

這些值只能放在 Vercel 環境變數或被 .gitignore 排除的本機檔案；不要放進 .env.example、前端程式或 Git。

## 3. 建立唯一管理員帳號

在專案根目錄登入 Vercel CLI 後，安全拉取 Production 變數到本機，再建立帳號：

~~~
vercel env pull .env.local --environment=production
npm run auth:create-admin -- rat-admin
~~~

腳本會隱藏輸入的密碼，並強制至少 14 個字元，且包含大寫、小寫、數字與符號。完成後，.env.local 仍是機密檔案，已被 .gitignore 排除。不要把密碼、資料庫連線字串或產生的金鑰傳給任何人。

若管理員遺失密碼，持有 Neon 與 Vercel 管理權限的人可在受信任的本機終端機執行下列指令。它會讓所有既有登入工作階段立即失效，並寫入稽核紀錄：

~~~
npm run auth:reset-password -- rat-admin
~~~

## 4. 部署與驗證

建立管理員帳號後，才部署含登入功能的版本。部署完成後，使用剛建立的 rat-admin 帳號登入 https://rat-monitor.vercel.app/login。

登入成功後，瀏覽器只持有 HttpOnly、Secure、SameSite=Strict 的 Session Cookie；資料庫只保存 Session Token 的 HMAC 摘要。Session 最長 8 小時，且 30 分鐘無互動即失效；同一帳號再次登入會撤銷舊工作階段。

## 操作原則

- 不建立公開註冊、Email 驗證或自助密碼重設頁面。
- 同一帳號與來源 IP 組合在 15 分鐘內連續失敗 5 次，會被暫時拒絕登入 15 分鐘。
- 若管理員遺失密碼，應由持有 Neon 與 Vercel 管理權限的人，透過上述受信任的本機管理流程重設；不可藉由公開網頁重設。
- 現有監測資料仍是 Mock Data。日後接入真實設備、事件或通知 API 時，每個 API 都必須在後端驗證此 Session 與角色，前端路由保護本身不是存取控制。
