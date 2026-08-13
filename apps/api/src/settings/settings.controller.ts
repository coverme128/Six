import { BadRequestException, Body, Controller, Get, Put } from "@nestjs/common";
import { getPrismaClient } from "@six/database";

type PublicSettings = {
  timezone: string;
  defaultCastMethod: "liuyao_manual";
  terminology: "beginner" | "professional";
  reportLanguage: "zh-CN" | "en-US";
};

const defaultSettings: PublicSettings = {
  timezone: "Asia/Shanghai",
  defaultCastMethod: "liuyao_manual",
  terminology: "beginner",
  reportLanguage: "zh-CN"
};

let settings: PublicSettings = { ...defaultSettings };

function validateTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new BadRequestException({ code: "VALIDATION_ERROR", message: "timezone must be an IANA timezone." });
  }
}

function normalizeSettings(value: unknown): PublicSettings {
  const next = { ...defaultSettings, ...(value && typeof value === "object" ? value : {}) } as PublicSettings;
  validateTimezone(next.timezone);
  if (next.defaultCastMethod !== "liuyao_manual") next.defaultCastMethod = defaultSettings.defaultCastMethod;
  if (!["beginner", "professional"].includes(next.terminology)) next.terminology = defaultSettings.terminology;
  if (!["zh-CN", "en-US"].includes(next.reportLanguage)) next.reportLanguage = defaultSettings.reportLanguage;
  return next;
}

async function readStoredSettings() {
  const prisma = getPrismaClient();
  if (!prisma) return settings;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "public" } });
    if (!row) return settings;
    settings = normalizeSettings(row.value);
    return settings;
  } catch {
    return settings;
  }
}

async function writeStoredSettings(next: PublicSettings) {
  const prisma = getPrismaClient();
  settings = next;
  if (!prisma) return settings;
  try {
    await prisma.appSetting.upsert({
      where: { key: "public" },
      update: { value: next as object },
      create: { key: "public", value: next as object }
    });
  } catch {
    return settings;
  }
  return settings;
}

@Controller("settings")
export class SettingsController {
  @Get()
  async getSettings() {
    return readStoredSettings();
  }

  @Put()
  async updateSettings(@Body() body: Partial<PublicSettings>) {
    const current = await readStoredSettings();
    const next = { ...current, ...body };
    validateTimezone(next.timezone);
    if (next.defaultCastMethod !== "liuyao_manual") {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Unsupported default cast method." });
    }
    if (!["beginner", "professional"].includes(next.terminology)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Unsupported terminology mode." });
    }
    if (!["zh-CN", "en-US"].includes(next.reportLanguage)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Unsupported report language." });
    }
    return writeStoredSettings(next);
  }
}
