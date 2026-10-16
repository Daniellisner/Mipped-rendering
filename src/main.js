const canvas = document.getElementById("canvas")


if (!navigator.gpu)
    console.error("navigator.gpu not found")
if (!navigator.gpu.wgslLanguageFeatures.has("packed_4x8_integer_dot_product")) {
    throw new Error("Packed 4x8 integer functions are not supported by this GPU.");
}
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter)
    alert("adapter not found")
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });
  device.addEventListener('uncapturederror', (event) => {
    alert(event.error.message);
  });

   const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders',
    code: /* wgsl */ `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
 
        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }
 
      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }

      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
 
      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
  });

    const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
      entryPoint: 'vs',
      module,
    },
    fragment: {
      entryPoint: 'fs',
      module,
      targets: [{ format: presentationFormat }],
    },
  });

    const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };  

    const computePipeline = device.createComputePipeline({
    label: 'doubling compute pipeline',
    layout: 'auto',
    compute: {
      entryPoint: 'computeSomething',
      module,
    },
  });

  const input = new Float32Array([1, 3, 5,7,8,9,23,567,896504,1,234,4]);

    const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

    device.queue.writeBuffer(workBuffer, 0, input);


    const resultBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

    const computeBindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: workBuffer  },
    ],
  });
  // Copy our input data to that buffer


    async function render() {
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();
 
    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    const computePass = encoder.beginComputePass({
    label: 'doubling compute pass',
  });
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  computePass.dispatchWorkgroups(input.length);
  computePass.end();

  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);
 
    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3);  // call our vertex shader 3 times
    pass.end();

    
 
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

      

  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());
 
alert(input);
alert(result);
 
  resultBuffer.unmap();
     
  }
 
  render();