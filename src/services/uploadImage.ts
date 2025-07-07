import ImageKit from "imagekit";

var imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: "https://ik.imagekit.io/ankitpatil/",
});

const uploadImage = async (image): Promise<string> => {
  return new Promise((resolve, reject) => {
    imagekit.upload(
      {
        file: image.buffer,
        fileName: image.originalname, 
      },
      function (error, result) {
        if (error) {
          console.error(error);
          reject(error);
        } else {
          console.log(result.url);
          resolve(result.url as string);
        }
      }
    );
  });
};

export default uploadImage;