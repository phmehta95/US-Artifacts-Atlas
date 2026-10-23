# Ultrasound artefact atlas

The atlas can run locally as a static site, or be deployed as an organisation-restricted Google Apps Script web app with private image storage in a Google Drive folder.

## Local preview

Open `index.html` or serve this folder locally. The local atlas can upload JPEG, PNG, and WebP images up to 6 MB each. Choose image files with the browser's file input, optionally enter a caption, then select **Upload images** to save them. Captions appear below their images in the artefact's scrollable gallery. Use **Delete image** on a gallery item to remove it from this browser. Images are stored in the browser's IndexedDB for the current site and browser profile and shown beside the artefact description.

Local images are not uploaded to Google Drive, shared with other users, or included automatically in backups. Clearing browser site data can remove them. Use the deployed Apps Script web app if images need to be shared through the private Drive folder.

## Google Workspace image hosting

The Apps Script backend is in `google-apps-script\Code.gs`. It stores images in a Drive folder owned by the account that deploys the app. The folder is not made public. Users sign into the Workspace web app; the server checks the Workspace domain for viewing and an explicit uploader email allowlist for uploads. Images are limited to JPEG, PNG, and WebP, up to 6 MB each. Captions and artefact IDs are stored as file descriptions in Drive.

Use only an organisation-approved Workspace account and fully de-identified images. Restrict the web app to your organisation; do not choose public access.

### Create and configure the Apps Script project

1. Confirm that your Workspace administrator allows Apps Script web apps and Drive access for this purpose.
2. Sign in to the approved Workspace account and create a project at [script.google.com](https://script.google.com).
3. Copy `google-apps-script\Code.gs` into the project's `Code.gs` file.
4. In the Apps Script editor, add HTML files named `Index`, `Styles`, and `Client`:
   - Paste `google-apps-script\Index.html` into `Index`.
   - Paste `google-apps-script\Styles.html` into `Styles`.
   - Paste `google-apps-script\Client.html` into `Client`.
5. Open **Project Settings → Script Properties** and add:
   - `ATLAS_ALLOWED_DOMAIN`: your Workspace domain, without the `@`.
   - `ATLAS_UPLOADER_EMAILS`: comma-separated, approved uploader email addresses.
6. Select `setupAtlasDrive` in the editor and run it once. Review and grant the requested Drive permission. This creates the private `Ultrasound Artefact Atlas Images` folder in the deploying account's Drive.
7. Select **Deploy → New deployment → Web app**:
   - **Execute as:** Me (the approved Workspace account that owns the image folder).
   - **Who has access:** users in your organisation's Workspace domain.
8. Deploy, complete any Workspace review/approval prompts, and open the resulting web app URL. Sign in with an account in the approved Workspace. An account must also be listed in `ATLAS_UPLOADER_EMAILS` to upload.

When changing the atlas, update `index.html`, `styles.css`, or `script.js`, then copy their corresponding generated Apps Script files into the project and create a new deployment version. The deployed site does not update just because the local files changed.

### Upload images

Open the deployed Workspace web app, choose an artefact, select a JPEG, PNG, or WebP image no larger than 6 MB, optionally add a caption, and select **Upload image**. The image should then appear in that artefact's gallery. Files are placed in the private Drive folder by the Apps Script server; do not change their sharing to “Anyone with the link.”

The image folder is owned by the account that deploys the app. Ensure your organisation approves that account, retention, access, and backup arrangements. The Drive folder itself is not a clinical record system.
