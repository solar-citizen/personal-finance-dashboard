import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  InspectPrivatBankResponseDto,
  UploadPrivatBankResponseDto,
  UploadPrivatBankStatementDto,
} from 'src/_generated/zod/pfd-dtos';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

import { PrivatBankService } from './privatbank.service';

@ApiTags('PrivatBank')
@Controller('api/privatbank')
export class PrivatBankController {
  constructor(private readonly privatBankService: PrivatBankService) {}

  @Post('inspect')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async inspectStatement(
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<InspectPrivatBankResponseDto> {
    if (!file?.buffer) {
      throw new BadRequestException('Statement file is required');
    }

    return await this.privatBankService.inspectStatement(userId, file.buffer);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStatement(
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: UploadPrivatBankStatementDto,
  ): Promise<UploadPrivatBankResponseDto> {
    if (!file?.buffer) {
      throw new BadRequestException('Statement file is required');
    }

    return await this.privatBankService.uploadStatement(
      userId,
      file.buffer,
      body ?? {},
    );
  }
}
