export async function requestPersistentStorage() {
  try {
    if (typeof navigator === "undefined") return { persisted: false, granted: false };
    const storage = (navigator as any).storage;
    if (!storage?.persist) return { persisted: false, granted: false };

    const persisted = (await storage.persisted?.()) ?? false;
    if (persisted) return { persisted: true, granted: true };

    const granted = await storage.persist();
    return { persisted: granted, granted };
  } catch {
    return { persisted: false, granted: false };
  }
}
