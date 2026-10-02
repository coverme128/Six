import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ReportStoreService } from "./report-store.service.js";

export function workspaceOwner(token: unknown): string {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    throw new UnauthorizedException({ code: "WORKSPACE_REQUIRED", message: "请在原浏览器中打开报告。匿名记录仅属于创建它的浏览器。" });
  }
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(@Inject(ReportStoreService) private readonly store: ReportStoreService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.workspaceOwner = workspaceOwner(request.headers["x-six-workspace"]);
    if (request.params.id) {
      const report = await this.store.find(request.params.id);
      if (!report || report.ownerId !== request.workspaceOwner) {
        throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "当前浏览器无权访问这份报告，或报告已删除。请使用创建报告的浏览器。" });
      }
    }
    return true;
  }
}
