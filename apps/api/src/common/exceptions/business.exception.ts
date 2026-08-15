import { HttpException, HttpStatus } from '@nestjs/common';

export interface BusinessErrorBody {
  code: string;
  message: string;
}

/**
 * 业务异常：使用稳定的业务错误码，由全局异常过滤器统一包装返回。
 *
 * 示例：throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
 */
export class BusinessException extends HttpException {
  constructor(code: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ code, message }, status);
  }
}
