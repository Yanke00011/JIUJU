import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser, toPublicUser } from '../common/utils/public-user';
import { BusinessException } from '../common/exceptions/business.exception';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BusinessException('USER_NOT_FOUND', '用户不存在', HttpStatus.NOT_FOUND);
    }
    return toPublicUser(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new BusinessException('USER_NOT_FOUND', '用户不存在', HttpStatus.NOT_FOUND);
    }

    const data: { nickname?: string; avatar?: string | null } = {};
    if (dto.nickname !== undefined) {
      data.nickname = dto.nickname.trim();
    }
    if (dto.avatar !== undefined) {
      data.avatar = dto.avatar;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return toPublicUser(user);
  }
}
