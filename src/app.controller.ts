import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

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
  async downloadBook(@Param('bookId') bookId: string) {
    const token = process.env.TOKEN;
    return await this.appService.downloadBook(bookId, token);
  }
}
