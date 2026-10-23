const IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg", signature: [255, 216, 255] },
  "image/png": { extension: "png", signature: [137, 80, 78, 71, 13, 10, 26, 10] },
  "image/webp": { extension: "webp" }
};
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ARTIFACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Ultrasound artefact atlas | Barts Health NHS Trust");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupAtlasDrive() {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty("ATLAS_DRIVE_FOLDER_ID");
  if (folderId) {
    const existingFolder = DriveApp.getFolderById(folderId);
    return { name: existingFolder.getName(), url: existingFolder.getUrl() };
  }

  const folder = DriveApp.createFolder("Ultrasound Artefact Atlas Images");
  properties.setProperty("ATLAS_DRIVE_FOLDER_ID", folder.getId());
  return { name: folder.getName(), url: folder.getUrl() };
}

function listArtifactImages(artifactId) {
  _requireWorkspaceUser_();
  _validateArtifactId_(artifactId);
  const folder = _getImageFolder_();
  const files = folder.getFiles();
  const images = [];

  while (files.hasNext()) {
    const file = files.next();
    const metadata = _readMetadata_(file);
    if (
      metadata &&
      metadata.artifactId === artifactId &&
      Object.prototype.hasOwnProperty.call(IMAGE_TYPES, file.getMimeType())
    ) {
      images.push({
        id: file.getId(),
        caption: metadata.caption,
        contentType: file.getMimeType()
      });
    }
  }

  return images.sort((first, second) => first.id.localeCompare(second.id));
}

function getArtifactImage(imageId) {
  _requireWorkspaceUser_();
  if (typeof imageId !== "string" || !/^[a-zA-Z0-9_-]{10,200}$/.test(imageId)) {
    throw new Error("Invalid image ID.");
  }

  let image;
  try {
    image = DriveApp.getFileById(imageId);
  } catch (error) {
    throw new Error("Image not found in the atlas folder.");
  }
  if (!_isInImageFolder_(image) || !_readMetadata_(image)) {
    throw new Error("Image not found in the atlas folder.");
  }

  const contentType = image.getMimeType();
  if (!Object.prototype.hasOwnProperty.call(IMAGE_TYPES, contentType)) {
    throw new Error("Unsupported image type.");
  }
  const bytes = image.getBlob().getBytes();
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 6 MB limit.");
  }
  return {
    contentType: contentType,
    data: Utilities.base64Encode(bytes)
  };
}

function uploadArtifactImage(artifactId, contentType, base64Data, caption) {
  _requireUploader_();
  _validateArtifactId_(artifactId);
  if (!Object.prototype.hasOwnProperty.call(IMAGE_TYPES, contentType)) {
    throw new Error("Upload a JPEG, PNG, or WebP image.");
  }
  if (typeof caption !== "string" || caption.length > 500) {
    throw new Error("Caption must be 500 characters or fewer.");
  }
  if (
    typeof base64Data !== "string" ||
    base64Data.length === 0 ||
    base64Data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)
  ) {
    throw new Error("The image data is invalid or exceeds the 6 MB limit.");
  }

  let bytes;
  try {
    bytes = Utilities.base64Decode(base64Data);
  } catch (error) {
    throw new Error("The image data could not be decoded.");
  }
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("The image must be no larger than 6 MB.");
  }
  if (!_matchesImageSignature_(bytes, contentType)) {
    throw new Error("The image contents do not match the selected file type.");
  }

  const extension = IMAGE_TYPES[contentType].extension;
  const safeFilename = `${artifactId}-${Utilities.getUuid()}.${extension}`;
  const blob = Utilities.newBlob(bytes, contentType, safeFilename);
  const file = _getImageFolder_().createFile(blob);
  file.setDescription(JSON.stringify({
    artifactId: artifactId,
    caption: caption.trim()
  }));

  return { id: file.getId() };
}

function _requireWorkspaceUser_() {
  const allowedDomain = PropertiesService.getScriptProperties().getProperty("ATLAS_ALLOWED_DOMAIN");
  const email = Session.getActiveUser().getEmail().toLowerCase();
  if (!allowedDomain || !email || !email.endsWith(`@${allowedDomain.toLowerCase()}`)) {
    throw new Error("Access is limited to signed-in users in the approved Google Workspace.");
  }
}

function _requireUploader_() {
  _requireWorkspaceUser_();
  const properties = PropertiesService.getScriptProperties();
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const allowedUploaders = (properties.getProperty("ATLAS_UPLOADER_EMAILS") || "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedUploaders.includes(email)) {
    throw new Error("Your account is not authorised to upload atlas images.");
  }
}

function _getImageFolder_() {
  const folderId = PropertiesService.getScriptProperties().getProperty("ATLAS_DRIVE_FOLDER_ID");
  if (!folderId) {
    throw new Error("Atlas Drive folder is not configured. Ask the project administrator to run setupAtlasDrive.");
  }
  try {
    return DriveApp.getFolderById(folderId);
  } catch (error) {
    throw new Error("The configured atlas Drive folder is unavailable.");
  }
}

function _isInImageFolder_(file) {
  const parents = file.getParents();
  const folderId = _getImageFolder_().getId();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) {
      return true;
    }
  }
  return false;
}

function _readMetadata_(file) {
  try {
    const metadata = JSON.parse(file.getDescription());
    if (
      metadata &&
      typeof metadata.artifactId === "string" &&
      ARTIFACT_ID_PATTERN.test(metadata.artifactId) &&
      typeof metadata.caption === "string"
    ) {
      return metadata;
    }
  } catch (error) {
    return null;
  }
  return null;
}

function _validateArtifactId_(artifactId) {
  if (typeof artifactId !== "string" || !ARTIFACT_ID_PATTERN.test(artifactId)) {
    throw new Error("Invalid artefact ID.");
  }
}

function _matchesImageSignature_(bytes, contentType) {
  if (contentType === "image/jpeg") {
    return (bytes[0] & 255) === 255 &&
      (bytes[1] & 255) === 216 &&
      (bytes[2] & 255) === 255 &&
      (bytes[bytes.length - 2] & 255) === 255 &&
      (bytes[bytes.length - 1] & 255) === 217;
  }
  if (contentType === "image/png") {
    const signature = IMAGE_TYPES[contentType].signature;
    return signature.every((value, index) => (bytes[index] & 255) === value);
  }
  return contentType === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}
