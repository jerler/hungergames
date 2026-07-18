export const MAX_PORTRAIT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_PORTRAIT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const PORTRAIT_ACCEPT_ATTRIBUTE = ACCEPTED_PORTRAIT_TYPES.join(",");

export function validatePortraitFile(file: File): string | null {
  if (!ACCEPTED_PORTRAIT_TYPES.includes(file.type as (typeof ACCEPTED_PORTRAIT_TYPES)[number])) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size > MAX_PORTRAIT_FILE_SIZE_BYTES) {
    return "Portraits must be 5 MB or smaller.";
  }

  return null;
}

export function readPortraitFile(file: File): Promise<string> {
  const validationError = validatePortraitFile(file);

  if (validationError) {
    return Promise.reject(new Error(validationError));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The selected portrait could not be read."));
        return;
      }

      resolve(reader.result);
    });

    reader.addEventListener("error", () => {
      reject(new Error("The selected portrait could not be read."));
    });

    reader.readAsDataURL(file);
  });
}
