export async function uploadToTelegram(file: File, botToken: string, chatId: string): Promise<string> {
  const uploadFormData = new FormData();
  uploadFormData.append("chat_id", chatId);

  // If GIF, convert MIME to jpeg (simulating old code logic)
  if (file.type.startsWith('image/gif')) {
    const newFileName = file.name.replace(/\.gif$/i, '.jpeg');
    const newFile = new File([file], newFileName, { type: 'image/jpeg' });
    uploadFormData.append("document", newFile);
  } else {
    uploadFormData.append("document", file);
  }

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    { method: 'POST', body: uploadFormData }
  );

  if (!telegramResponse.ok) {
    const errorData = await telegramResponse.json() as any;
    throw new Error(errorData.description || '上传到 Telegram 失败');
  }

  const responseData = await telegramResponse.json() as any;
  const fileId = responseData.result.video?.file_id
    || responseData.result.document?.file_id
    || responseData.result.sticker?.file_id;

  if (!fileId) throw new Error('返回的数据中没有文件 ID');

  return fileId;
}

export async function getTelegramFileUrl(fileId: string, botToken: string): Promise<string | null> {
  let filePath: string | undefined;

  for (let attempts = 0; attempts < 3; attempts++) {
    const getFilePath = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    if (getFilePath.ok) {
      const fileData = await getFilePath.json() as any;
      if (fileData.ok && fileData.result.file_path) {
        filePath = fileData.result.file_path;
        break;
      }
    }
  }

  if (!filePath) {
    return null;
  }

  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}
