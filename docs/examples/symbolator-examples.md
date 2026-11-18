---
title: Symbolator 硬件符号图
tags: [图表, 硬件, 教学]
---

# Symbolator 硬件符号图

` ```symbolator ` 围栏写入 Verilog / VHDL 源码，渲染成带分组端口的硬件符号图。
适合芯片手册、FPGA 模块说明与接口草图；端口分组用注释声明：

```verilog
//# {{分组标识|分组标题}}
input wire clock,
```

## 基础模块

**源码**：

````markdown
```symbolator
module adder (
  input wire [7:0] a,
  input wire [7:0] b,
  output wire [7:0] y
);
endmodule
```
````

**渲染效果**：

```symbolator
module adder (
  input wire [7:0] a,
  input wire [7:0] b,
  output wire [7:0] y
);
endmodule
```

## 带参数与端口分组

**源码**：

````markdown
```symbolator
module demo_device #(
    //# {{}}
    parameter SIZE = 8,
    parameter RESET_ACTIVE_LEVEL = 1
) (
    //# {{clocks|Clocking}}
    input wire clock,
    //# {{control|Control signals}}
    input wire reset,
    input wire enable,
    //# {{data|Data ports}}
    input wire [SIZE-1:0] data_in,
    output wire [SIZE-1:0] data_out
);
  // ...
endmodule
```
````

**渲染效果**：

```symbolator
module demo_device #(
    //# {{}}
    parameter SIZE = 8,
    parameter RESET_ACTIVE_LEVEL = 1
) (
    //# {{clocks|Clocking}}
    input wire clock,
    //# {{control|Control signals}}
    input wire reset,
    input wire enable,
    //# {{data|Data ports}}
    input wire [SIZE-1:0] data_in,
    output wire [SIZE-1:0] data_out
);
  // ...
endmodule
```

## FIFO：读写与状态分组

**源码**：

````markdown
```symbolator
module fifo #(
  //# {{}}
  parameter WIDTH = 32,
  parameter DEPTH = 16
) (
  //# {{clock|Clock}}
  input wire clk,
  input wire rst_n,
  //# {{write|Write port}}
  input wire wr_en,
  input wire [WIDTH-1:0] din,
  //# {{read|Read port}}
  input wire rd_en,
  output wire [WIDTH-1:0] dout,
  //# {{status|Status}}
  output wire full,
  output wire empty
);
endmodule
```
````

**渲染效果**：

```symbolator
module fifo #(
  //# {{}}
  parameter WIDTH = 32,
  parameter DEPTH = 16
) (
  //# {{clock|Clock}}
  input wire clk,
  input wire rst_n,
  //# {{write|Write port}}
  input wire wr_en,
  input wire [WIDTH-1:0] din,
  //# {{read|Read port}}
  input wire rd_en,
  output wire [WIDTH-1:0] dout,
  //# {{status|Status}}
  output wire full,
  output wire empty
);
endmodule
```

## 双向信号与串行接口

**源码**：

````markdown
```symbolator
module sfp_controller (
  input wire clk,
  input wire rst,
  input wire [7:0] rx_data,
  output wire [7:0] tx_data,
  output wire tx_en,
  inout wire i2c_sda,
  output wire i2c_scl
);
endmodule
```
````

**渲染效果**：

```symbolator
module sfp_controller (
  input wire clk,
  input wire rst,
  input wire [7:0] rx_data,
  output wire [7:0] tx_data,
  output wire tx_en,
  inout wire i2c_sda,
  output wire i2c_scl
);
endmodule
```

## AXI-Lite 写通道

**源码**：

````markdown
```symbolator
module axi_lite_regs #(
  parameter ADDR_WIDTH = 8,
  parameter DATA_WIDTH = 32
) (
  //# {{aw|Write address}}
  input wire [ADDR_WIDTH-1:0] awaddr,
  input wire awvalid,
  output wire awready,
  //# {{w|Write data}}
  input wire [DATA_WIDTH-1:0] wdata,
  input wire wvalid,
  output wire wready,
  //# {{b|Write response}}
  output wire [1:0] bresp,
  output wire bvalid,
  input wire bready
);
endmodule
```
````

**渲染效果**：

```symbolator
module axi_lite_regs #(
  parameter ADDR_WIDTH = 8,
  parameter DATA_WIDTH = 32
) (
  //# {{aw|Write address}}
  input wire [ADDR_WIDTH-1:0] awaddr,
  input wire awvalid,
  output wire awready,
  //# {{w|Write data}}
  input wire [DATA_WIDTH-1:0] wdata,
  input wire wvalid,
  output wire wready,
  //# {{b|Write response}}
  output wire [1:0] bresp,
  output wire bvalid,
  input wire bready
);
endmodule
```

## UART：时钟、引脚与寄存器总线

**源码**：

````markdown
```symbolator
module uart #(
  parameter CLK_FREQ = 50_000_000,
  parameter BAUD = 115200
) (
  //# {{clock|Clock / reset}}
  input wire clk,
  input wire rst,
  //# {{uart|UART pins}}
  input wire rx,
  output wire tx,
  //# {{bus|Register bus}}
  input wire [7:0] addr,
  input wire [7:0] wdata,
  input wire we,
  output wire [7:0] rdata
);
endmodule
```
````

**渲染效果**：

```symbolator
module uart #(
  parameter CLK_FREQ = 50_000_000,
  parameter BAUD = 115200
) (
  //# {{clock|Clock / reset}}
  input wire clk,
  input wire rst,
  //# {{uart|UART pins}}
  input wire rx,
  output wire tx,
  //# {{bus|Register bus}}
  input wire [7:0] addr,
  input wire [7:0] wdata,
  input wire we,
  output wire [7:0] rdata
);
endmodule
```

## SPI 主控

**源码**：

````markdown
```symbolator
module spi_master (
  //# {{clock|Clock}}
  input wire clk,
  input wire rst,
  //# {{control|Control}}
  input wire start,
  input wire [1:0] mode,
  output wire busy,
  //# {{spi|SPI bus}}
  output wire sclk,
  output wire mosi,
  input wire miso,
  output wire [3:0] cs_n
);
endmodule
```
````

**渲染效果**：

```symbolator
module spi_master (
  //# {{clock|Clock}}
  input wire clk,
  input wire rst,
  //# {{control|Control}}
  input wire start,
  input wire [1:0] mode,
  output wire busy,
  //# {{spi|SPI bus}}
  output wire sclk,
  output wire mosi,
  input wire miso,
  output wire [3:0] cs_n
);
endmodule
```

## RAM：参数化位宽

**源码**：

````markdown
```symbolator
module ram #(
  parameter ADDR_W = 10,
  parameter DATA_W = 32
) (
  input wire clk,
  input wire we,
  input wire [ADDR_W-1:0] addr,
  input wire [DATA_W-1:0] wdata,
  output reg [DATA_W-1:0] rdata
);
endmodule
```
````

**渲染效果**：

```symbolator
module ram #(
  parameter ADDR_W = 10,
  parameter DATA_W = 32
) (
  input wire clk,
  input wire we,
  input wire [ADDR_W-1:0] addr,
  input wire [DATA_W-1:0] wdata,
  output reg [DATA_W-1:0] rdata
);
endmodule
```

## VHDL：计数器

**源码**：

````markdown
```symbolator
entity counter is
  port (
    clk : in std_logic;
    rst : in std_logic;
    en : in std_logic;
    q : out std_logic_vector(7 downto 0)
  );
end entity counter;
```
````

**渲染效果**：

```symbolator
entity counter is
  port (
    clk : in std_logic;
    rst : in std_logic;
    en : in std_logic;
    q : out std_logic_vector(7 downto 0)
  );
end entity counter;
```

## VHDL：带 generic 的加法器

**源码**：

````markdown
```symbolator
entity adder is
  generic (
    WIDTH : integer := 8
  );
  port (
    a : in std_logic_vector(WIDTH-1 downto 0);
    b : in std_logic_vector(WIDTH-1 downto 0);
    cin : in std_logic;
    sum : out std_logic_vector(WIDTH-1 downto 0);
    cout : out std_logic
  );
end entity adder;
```
````

**渲染效果**：

```symbolator
entity adder is
  generic (
    WIDTH : integer := 8
  );
  port (
    a : in std_logic_vector(WIDTH-1 downto 0);
    b : in std_logic_vector(WIDTH-1 downto 0);
    cin : in std_logic;
    sum : out std_logic_vector(WIDTH-1 downto 0);
    cout : out std_logic
  );
end entity adder;
```
