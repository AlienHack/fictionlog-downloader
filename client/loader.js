/* This is all just to start and stop the animation. Technically, the animation itself only uses CSS. */

document.querySelector('button').addEventListener(
  'click',
  function () {
    activateLoadAnim(false);
    let token = document.querySelector('input[name=token]').value;
    let bookId = document.querySelector('input[name=bookId]').value;
    let bookType = document.querySelector('input[name=bookType]:checked').value;

    if (!token) {
      stopAnim();
      Swal.fire({
        title: 'มีข้อผิดพลาด',
        text: 'กรุณาระบุ Access Token ให้ถูกต้อง',
        icon: 'error',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    if (!bookType) {
      stopAnim();
      Swal.fire({
        title: 'มีข้อผิดพลาด',
        text: 'กรุณาระบุรูปแบบหนังสือให้ถูกต้อง',
        icon: 'error',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    if (!bookId) {
      stopAnim();
      Swal.fire({
        title: 'มีข้อผิดพลาด',
        text: 'กรุณาระบุรหัสหนังสือให้ถูกต้อง',
        icon: 'error',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    let downloadUrl =
      '/api/downloadBook/' +
      bookId +
      '?token=' +
      token +
      '&bookType=' +
      bookType;

    fetch(downloadUrl).then((response) => {
      if (!response.ok) {
        stopAnim();
        if (response.status == 403) {
          Swal.fire({
            title: 'มีข้อผิดพลาด',
            text: 'รหัส AccessToken ผิดหรือหมดอายุ',
            icon: 'error',
            confirmButtonText: 'ตกลง',
          });
          return;
        } else if (response.status == 400 || response.status == 404) {
          Swal.fire({
            title: 'มีข้อผิดพลาด',
            text: 'รหัสหนังสือไม่ถูกต้องหรือไม่พบข้อมูลหนังสือ',
            icon: 'error',
            confirmButtonText: 'ตกลง',
          });
          return;
        }
      }
      response.blob().then((blob) => {
        download(blob);
        stopAnim();
      });
    });
  },
  false,
);

function activateLoadAnim() {
  document.querySelector('#loading').classList.remove('animate');
  document.querySelector('button').blur();
  document.querySelector('#loading').classList.add('animate');
}

function stopAnim() {
  document.querySelector('#loading').classList.remove('animate');
}
