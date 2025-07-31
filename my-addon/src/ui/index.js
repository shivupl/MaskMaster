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
    let maskImage = null; // Store the mask image
    let currentBlobUrl = null; // Track current blob URL for cleanup


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
    videoBtn.disabled = true;
    imageBtn.disabled = true; // Disable Mask Image button by default

    // Function to clean up blob URLs
    function cleanupBlobUrl() {
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
    }

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

            // Show Croppie interface for cropping the mask image
            const url = URL.createObjectURL(file);
            await showCroppieInterface(url, async (croppedBlob) => {
                // Show loading state
                outputContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Masking image...</div>';

                try {
                    // call
                    const result = await callMaskImage(processedImage, croppedBlob);
                    console.log("result", result);
                    outputContainer.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
                } catch (error) {
                    console.error("Error processing image:", error);
                    outputContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff0000;">Error processing image. Please try again.</div>';
                }
            });
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
            
            // Clean up previous blob URL
            cleanupBlobUrl();
            
            const url = URL.createObjectURL(file);
            currentBlobUrl = url; // Track the new blob URL
            processedImage = file;
            console.log("processedImage", processedImage, url);
            container.innerHTML = `<img src="${url}" alt="Canvas preview" style="max-width: 100%; height: auto;" />`;
            
            // Enable Mask Image button since we now have a base image
            imageBtn.disabled = false;
        };
    });

    function showCroppieInterface(imageUrl, onCropComplete) {
        return new Promise((resolve) => {
            // Create modal overlay
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.57);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 1000;
                display: flex;
                flex-direction: column;
            `;

            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                background:rgb(30, 136, 229);
                color: white;
                padding: 12px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #444;
            `;
            header.innerHTML = `
                <div style="font-weight: 600; font-size: 16px;">Adjust Image Mask</div>
                <button id="close-crop-btn" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">×</button>
            `;

            // Content area
            const content = document.createElement('div');
            content.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                padding: 20px;
                align-items: center;
            `;

            // Croppie container with background
            const croppieContainer = document.createElement('div');
            croppieContainer.style.cssText = `
                width: 100%;
                max-width: 300px;
                height: 225px;
                background: #1a1a1a;
                border-radius: 8px;
                overflow: hidden;
                margin-bottom: 20px;
                position: relative;
                
            `;

            // Add background image (original uploaded object)
            let croppieInstance = null;
            let backgroundBlobUrl = null; // Track background blob URL
            
            if (processedImage) {
                const backgroundUrl = URL.createObjectURL(processedImage);
                backgroundBlobUrl = backgroundUrl; // Track for cleanup
                
                // Wait for background image to load to get its dimensions
                const tempImg = new Image();
                tempImg.onload = () => {
                    const imgWidth = tempImg.naturalWidth;
                    const imgHeight = tempImg.naturalHeight;
                    
                    // Calculate the scale factor to fit the background image in the container
                    const containerWidth = 300;
                    const containerHeight = 225;
                    const scaleX = containerWidth / imgWidth;
                    const scaleY = containerHeight / imgHeight;
                    const scale = Math.min(scaleX, scaleY) * 0.8; // 80% of max fit
                    
                    // Calculate the scaled dimensions
                    const scaledWidth = imgWidth * scale;
                    const scaledHeight = imgHeight * scale;
                    
                    // Initialize Croppie with fixed viewport size matching the background image
                    croppieInstance = new Croppie(croppieContainer, {
                        viewport: { 
                            width: Math.round(scaledWidth), 
                            height: Math.round(scaledHeight), 
                            type: 'square' 
                        },
                        boundary: { width: containerWidth, height: containerHeight },
                        enableOrientation: false, // Disable rotation to keep fixed size
                        enableResize: false, // Disable resize to keep fixed size
                        showZoomer: true,
                        enableZoom: true,
                        mouseWheelZoom: true,
                        enableExif: true
                    });
                    
                    croppieInstance.bind({
                        url: imageUrl
                    });
                    
                    // After Croppie is initialized, add the background image on top of the viewport
                    setTimeout(() => {
                        const viewport = croppieContainer.querySelector('.cr-viewport');
                        if (viewport) {
                            // Create a new background image specifically for the viewport
                            const viewportBackgroundImg = new Image();
                            viewportBackgroundImg.src = backgroundUrl;
                            viewportBackgroundImg.style.cssText = `
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                opacity: 0.8;
                                pointer-events: none;
                                z-index: 10;
                                mix-blend-mode: multiply;
                            `;
                            viewport.appendChild(viewportBackgroundImg);
                        }
                    }, 100);
                };
                tempImg.src = backgroundUrl;
            } else {
                // Fallback if no background image
                croppieInstance = new Croppie(croppieContainer, {
                    viewport: { width: 150, height: 150, type: 'square' },
                    boundary: { width: 300, height: 225 },
                    enableOrientation: false,
                    enableResize: false,
                    showZoomer: true,
                    enableZoom: true,
                    mouseWheelZoom: true,
                    enableExif: true
                });
                
                croppieInstance.bind({
                    url: imageUrl
                });
            }

            // Buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 10px;
                justify-content: center;
                align-items: center;
            `;
            buttonContainer.innerHTML = `
                <div style="font-size: 12px; color: #999; text-align: center">Scroll to zoom</div>
                <div style="display: flex; gap: 10px;">
                    <button id="crop-btn" style="background: #0078d4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 14px;">Apply Crop</button>
                    <button id="cancel-crop-btn" style="background: #444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                </div>
            `;

            // Assemble modal
            content.appendChild(croppieContainer);
            content.appendChild(buttonContainer);
            modal.appendChild(header);
            modal.appendChild(content);
            document.body.appendChild(modal);

            // Add CSS to reduce Croppie overlay opacity and make overlay less bright
            const style = document.createElement('style');
            style.textContent = `
                .cr-viewport {
                    opacity: 0.6 !important;
                }
                .cr-overlay {
                    opacity: 0.4 !important;
                }
                .cr-viewport img {
                    filter: brightness(0.7) !important;
                }
            `;

            document.head.appendChild(style);

            // Event handlers
            document.getElementById('crop-btn').addEventListener('click', () => {
                if (croppieInstance) {
                    croppieInstance.result({
                        type: 'blob',
                        size: 'original',
                        format: 'png'
                    }).then((blob) => {
                        onCropComplete(blob);
                        document.body.removeChild(modal);
                        document.head.removeChild(style);
                        
                        // Clean up blob URLs
                        if (backgroundBlobUrl) {
                            URL.revokeObjectURL(backgroundBlobUrl);
                        }
                        
                        resolve();
                    }).catch((error) => {
                        console.error('Croppie error:', error);
                        document.body.removeChild(modal);
                        document.head.removeChild(style);
                        
                        // Clean up blob URLs
                        if (backgroundBlobUrl) {
                            URL.revokeObjectURL(backgroundBlobUrl);
                        }
                        
                        resolve();
                    });
                }
            });

            document.getElementById('cancel-crop-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                document.head.removeChild(style);
                
                // Clean up blob URLs
                if (backgroundBlobUrl) {
                    URL.revokeObjectURL(backgroundBlobUrl);
                }
                
                resolve();
            });

            document.getElementById('close-crop-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                document.head.removeChild(style);
                
                // Clean up blob URLs
                if (backgroundBlobUrl) {
                    URL.revokeObjectURL(backgroundBlobUrl);
                }
                
                resolve();
            });
        });
    }


    async function callMaskImage(foregroundBlob, backgroundBlob) {
        const formData = new FormData();
        formData.append("foreground", foregroundBlob, "fg.png");
        formData.append("background", backgroundBlob, "bg.png");
    
        const response = await fetch("https://backend-billowing-waterfall-2609.fly.dev/mask-image", {
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
    
        const response = await fetch("https://backend-billowing-waterfall-2609.fly.dev/mask-video", {
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

            // Show loading state
            outputContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Masking video...</div>';

            try {
                // call
                const result = await callMaskVideo(processedImage, file);
                const resultBlob = result.blob;
                console.log("result", result);
                // container.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
                // const r = URL.createObjectURL(result);
                // container.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
                outputContainer.innerHTML = `<video src="${result}" alt="Canvas preview" autoplay muted />`;
            } catch (error) {
                console.error("Error processing video:", error);
                outputContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff0000;">Error processing video. Please try again.</div>';
            }
        };

        //execute rest

        console.log("processedImage", processedImage);

        
    });

    // Create Outter Mask
    maskBtn.addEventListener("click", async () => {
        console.log("Mask clicked");        

        // Show loading state
        outputContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Creating outer mask...</div>';

        try {
            const result = await callGetMask(processedImage);
            console.log("result", result);

            outputContainer.innerHTML = `<img src="${result}" alt="Canvas preview" />`;
        } catch (error) {
            console.error("Error creating mask:", error);
            outputContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff0000;">Error creating mask. Please try again.</div>';
        }

        console.log("processedImage", processedImage);
        
    });

    async function callGetMask(foregroundBlob) {
        const formData = new FormData();
        formData.append("foreground", foregroundBlob, "fg.png");
    
        // Include color as JSON string
        formData.append("color", JSON.stringify(selectedColor));
    
        const response = await fetch("https://backend-billowing-waterfall-2609.fly.dev/outter-mask-image", {
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
        
        // Clean up previous blob URL
        cleanupBlobUrl();
        
        // const url = URL.createObjectURL(croppedImage);
        const url = URL.createObjectURL(processedImage);
        currentBlobUrl = url; // Track the new blob URL
        console.log("url - -", url);
        
        // Enable Mask Image button since we now have a base image
        imageBtn.disabled = false;
        
        return url;
    }

    async function processImage(blob) {
        const formData = new FormData();
        formData.append("image", blob, "input.png");

        try {
            const response = await fetch("https://backend-billowing-waterfall-2609.fly.dev/process", {
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

