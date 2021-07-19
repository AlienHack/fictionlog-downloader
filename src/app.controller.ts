import { HttpException, HttpStatus, Res } from '@nestjs/common';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

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

  @Get('clearTokens')
  async clearTokens() {
    return await this.appService.clearTokens();
  }

  @Get('regenerateLibraries')
  async refreshLibrariesAllToken() {
    return await this.appService.refreshLibrariesAllToken();
  }

  //APPS
  @Get('downloadBook/:bookId')
  async downloadBook(
    @Param('bookId') bookId: string,
    @Query('token') token: string,
    @Query('bookType') bookType: string,
    @Query('isGen') isGen: string,
    @Res() res: Response,
  ) {
    token = token || process.env.TOKEN;
    bookType = bookType || 'epub';
    let gen;

    if (!isGen) {
      gen = true;
    } else {
      gen = isGen == 'true';
    }

    const bookData = await this.appService.downloadBook(
      bookId,
      token,
      bookType,
      gen,
    );
    if (!gen) return res.json({ status: 'success' });
    if (!bookData.success)
      throw new HttpException(
        'Invalid book ID or Authentication Error',
        HttpStatus.BAD_REQUEST,
      );
    return res.download(bookData.bookPath, bookData.bookName);
  }

  @Get('purchaseBook/:bookId')
  async purchaseBook(
    @Param('bookId') bookId: string,
    @Query('token') token: string,
  ) {
    token = token || process.env.TOKEN;
    return this.appService.purchaseAllChapters(bookId, token);
  }

  @Get('purchaseBookToLibrary/:bookId')
  async purchaseBookToLibrary(
    @Param('bookId') bookId: string,
    @Query('token') token: string,
  ) {
    token = token || process.env.TOKEN;
    return this.appService.purchaseAllChaptersToLibrary(bookId, token);
  }

  @Get('generateEbooks')
  async generateEbooks(@Query('token') token: string) {
    token = token || process.env.TOKEN;
    return await this.appService.generateEbooks(token);
  }
}
