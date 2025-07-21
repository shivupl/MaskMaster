import addOnUISdk, { ColorPickerEvent } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

console.log("addOnUISdk", addOnUISdk);
addOnUISdk.ready.then(async () => {
    console.log("addOnUISdk is ready for use.");

    // Get the UI runtime.
    const { runtime } = addOnUISdk.instance;
    const { app, constants } = addOnUISdk;

    const sandboxProxy = await runtime.apiProxy("documentSandbox");

    let processedImage = null;
    let selectedColor = [0, 0, 0, 255]; 
    let currentImage = null;


    const previewBtn = document.getElementById("previewCanvasBtn");
    const container = document.getElementById("selectedElementInfo");
    const imageBtn = document.getElementById("imageBtn");
    const videoBtn = document.getElementById("videoBtn");
    const outputContainer = document.getElementById("outputedItem");
    const maskBtn = document.getElementById("maskBtn");
    const colorPickerBtn = document.getElementById("color-picker-button");
    const addToCanvasBtn = document.getElementById("addToCanvasBtn");
    const uploadPngBtn = document.getElementById("uploadPngBtn");

    addToCanvasBtn.disabled = true;
    addToCanvasBtn.hidden = true;

    colorPickerBtn.addEventListener("click", () => {
        app.showColorPicker(colorPickerBtn, {
            title: "Choose Background Color",
            placement: constants.ColorPickerPlacement.right,
            disableAlphaChannel: false,
            eyedropperHidesPicker: false,
        });
    });
    
    colorPickerBtn.addEventListener(ColorPickerEvent.colorChange, (event) => {
        const hexColor = event.detail.color;
        
        // Parse hex color string (e.g., "#2866FAFF")
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = parseInt(hex.substring(6, 8), 16);
        
        selectedColor = [r, g, b, a];
        
        // Change the color picker button color to match the selected color
        const colorPickerBtn = document.getElementById("color-picker-button");
        if (colorPickerBtn) {
            const rgbString = `rgb(${r}, ${g}, ${b})`;
            colorPickerBtn.style.backgroundColor = rgbString;
            // Also update hover state
            colorPickerBtn.style.setProperty('--hover-color', `rgb(${Math.max(0, r-50)}, ${Math.max(0, g-50)}, ${Math.max(0, b-50)})`);
        }
    });
    

    previewBtn.addEventListener("click", async () => {
        container.textContent = "Loading preview…";
        console.log("here1");
        try {
            const [rend] = await app.document.createRenditions(
                {
                    range: constants.Range.currentPage,
                    format: constants.RenditionFormat.png,
                },
                constants.RenditionIntent.preview
            );
            console.log("here2");
            const url = URL.createObjectURL(rend.blob);

            const result = await imagePreview(url);
            console.log("result", result);

            // container.innerHTML = `<img src="${url}" alt="Canvas preview" />`;
            container.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
        } catch (error){
            console.log("error", error);
            container.textContent = "Preview failed.";
        }
        // await sandboxProxy.createRectangle();

    });


    // Masking image
    imageBtn.addEventListener("click", async () => {
        console.log("imageBtn clicked");
        
        // handle image upload
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();


        input.onchange = async (e) => {
            const file = e.target.files[0];
            console.log(file);
            if(!file) return;

            // call
            const result = await callMaskImage(processedImage, file);
            console.log("result", result);
            // container.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
            // const r = URL.createObjectURL(result);
            // container.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
            outputContainer.innerHTML = `<img src="${result}" alt="Canvas preview" />`;


        };

        //execute rest

        console.log("processedImage", processedImage);


    });

    uploadPngBtn.addEventListener("click", async () => {
        console.log("uploadPngBtn clicked");

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if(!file) return;

            console.log("file", file);
            const url = URL.createObjectURL(file);
            processedImage = file;
            console.log("processedImage", processedImage, url);
            container.innerHTML = `<img src="${url}" alt="Canvas preview" />`;

        };
        


    });

    async function callMaskImage(foregroundBlob, backgroundBlob) {
        const formData = new FormData();
        formData.append("foreground", foregroundBlob, "fg.png");
        formData.append("background", backgroundBlob, "bg.png");
    
        const response = await fetch("http://127.0.0.1:5002/mask-image", {
            method: "POST",
            body: formData,
        });
    
        if (!response.ok) throw new Error("Failed to apply mask");
    
        const resultBlob = await response.blob();
        const resultUrl = URL.createObjectURL(resultBlob);
    
        // const img = new Image();
        // img.src = resultUrl;
        // document.body.appendChild(img);
        currentImage = resultBlob;
        addToCanvasBtn.disabled = false;
        addToCanvasBtn.hidden = false;

        return resultUrl;
    }


    async function addToCanvas(blob) {
        if(blob.type === "image/png") {
            await addOnUISdk.app.document.addImage(blob, {
            title: "Step Image",
            author: "Your App",
            });
    } else if(blob.type === "video/mp4") {
        await addOnUISdk.app.document.addVideo(blob, {
            title: "Step Video",
            author: "Your App",
            });
        }
    }
    addToCanvasBtn.addEventListener("click", async () => {
        await addToCanvas(currentImage);
    });

    async function callMaskVideo(foregroundBlob, backgroundBlob) {
        const formData = new FormData();
        formData.append("foreground", foregroundBlob, "fg.png");
        formData.append("background", backgroundBlob, "bg.mp4");
    
        const response = await fetch("http://127.0.0.1:5002/mask-video", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) throw new Error("Failed to apply mask");
    
        const resultBlob = await response.blob();
        const resultUrl = URL.createObjectURL(resultBlob);

        addToCanvasBtn.disabled = false;
        addToCanvasBtn.hidden = false;
        currentImage = resultBlob;

        outputContainer.innerHTML = `
        <video controls autoplay muted style="max-width: 100%; height: auto;">
            <source src="${resultUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
        `;
    
        // const img = new Image();
        // img.src = resultUrl;
        // document.body.appendChild(img);
        const video = document.createElement("video");
        video.controls = true;
        video.autoplay = true;
        video.src = resultUrl;

        return resultUrl;
    }



    // Masking video
    videoBtn.addEventListener("click", async () => {
        console.log("Video clicked");
        
        // handle video upload
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.click();


        input.onchange = async (e) => {
            const file = e.target.files[0];
            console.log(file);
            if(!file) return;

            // call
            const result = await callMaskVideo(processedImage, file);
            const resultBlob = result.blob;
            console.log("result", result);
            // container.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
            // const r = URL.createObjectURL(result);
            // container.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
            outputContainer.innerHTML = `<video src="${result}" alt="Canvas preview" autoplay muted />`;


        };

        //execute rest

        console.log("processedImage", processedImage);

        
    });

    // Create Outter Mask
    maskBtn.addEventListener("click", async () => {
        console.log("Mask clicked");        

        const result = await callGetMask(processedImage);
        console.log("result", result);

        outputContainer.innerHTML = `<img src="${result}" alt="Canvas preview" />`;

        console.log("processedImage", processedImage);
        
    });

    async function callGetMask(foregroundBlob) {
        const formData = new FormData();
        formData.append("foreground", foregroundBlob, "fg.png");
    
        // Include color as JSON string
        formData.append("color", JSON.stringify(selectedColor));
    
        const response = await fetch("http://127.0.0.1:5002/outter-mask-image", {
            method: "POST",
            body: formData,
        });
    
        if (!response.ok) throw new Error("Failed to apply mask");
    
        const resultBlob = await response.blob();
        const resultUrl = URL.createObjectURL(resultBlob);
        currentImage = resultBlob;
        addToCanvasBtn.disabled = false;
        addToCanvasBtn.hidden = false;
    
        const img = new Image();
        img.src = resultUrl;
    
        return resultUrl;
    }
    



    const getSelectedItems = async () => {
        const res = await sandboxProxy.getSelectedItems();
        console.log("result", res);

        const item = res.items[0];

        const bounds = {
            x: item.position.x,
            y: item.position.y,
            width: item.size.width,
            height: item.size.height
        };
        console.log("bounds", bounds);
        return bounds;
          
    }

    function cropImage(img, bounds) {
        console.log("img", img);
        console.log("bounds", bounds);
        const canvas = document.createElement("canvas");
        canvas.width = bounds.width;
        canvas.height = bounds.height;
        const ctx = canvas.getContext("2d");
        console.log("ctx", ctx);
      
        ctx.drawImage(
          img,
          bounds.x, bounds.y, bounds.width, bounds.height,  // source
          0, 0, bounds.width, bounds.height                  // destination
        );
        console.log("ctx2", ctx);
      
        return new Promise((resolve) => {
          canvas.toBlob((croppedBlob) => resolve(croppedBlob), "image/png");
        });
    }

    function imageFromURL(url) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous"; // only needed for remote URLs
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      }
      

    async function imagePreview(img) {
        const bounds = await getSelectedItems();
        const image = await imageFromURL(img);
        const croppedImage = await cropImage(image, bounds);
        processedImage = await processImage(croppedImage);
        console.log("url1 - -", croppedImage);
        // const url = URL.createObjectURL(croppedImage);
        const url = URL.createObjectURL(processedImage);
        console.log("url - -", url);
        return url;

    }

    async function processImage(blob) {
        const formData = new FormData();
        formData.append("image", blob, "input.png");

        try {
            const response = await fetch("http://127.0.0.1:5002/process", {
              method: "POST",
              body: formData
            });
            console.log("checkpt");
        
            if (!response.ok) {
              throw new Error("Failed to process image");
            }
        
            const processedBlob = await response.blob();
            const url = URL.createObjectURL(processedBlob);
        
            // Optional: Display result
            const img = new Image();
            img.src = url;
        
            // Or: return the blob
            console.log("processedBlob");
            return processedBlob;
          } catch (error) {
            console.error("Upload error:", error);
          }
    }


      

});

