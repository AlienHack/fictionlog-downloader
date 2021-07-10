import { Res } from '@nestjs/common';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  welcome(): string {
    return this.appService.welcome();
  }

  //RAW API
  @Get('getBookDetail/:bookId/:token')
  async getBookDetail(
    @Param('bookId') bookId: string,
    @Param('token') token: string,
  ) {
    return await this.appService.getBookDetail(bookId, token);
  }

  @Get('getChapterDetail/:chapterId/:token')
  async getChapterDetail(
    @Param('chapterId') chapterId: string,
    @Param('token') token: string,
  ) {
    return await this.appService.getChapterDetail(chapterId, token);
  }

  @Get('getChapterList/:bookId/:token')
  async getChapterList(
    @Param('bookId') bookId: string,
    @Param('token') token: string,
  ) {
    return await this.appService.getChapterList(bookId, token);
  }

  @Get('isAuthenticated/:token')
  async isAuthenticated(@Param('token') token: string) {
    return await this.appService.isAuthenticated(token);
  }

  //FILTERED
  @Get('getAvailableChapters/:bookId/:token')
  async getAvailableChapters(
    @Param('bookId') bookId: string,
    @Param('token') token: string,
  ) {
    return await this.appService.getAvailableChapterToDownload(bookId, token);
  }

  //APPS
  @Get('downloadBook/:bookId')
  async downloadBook(
    @Param('bookId') bookId: string,
    @Query('token') token: string,
    @Query('bookType') bookType: string,
    @Res() res: Response,
  ) {
    token = token || process.env.TOKEN;
    bookType = bookType || 'epub';
    const bookData = await this.appService.downloadBook(
      bookId,
      token,
      bookType,
    );
    return res.download(bookData.bookPath, bookData.bookName);
  }
}
