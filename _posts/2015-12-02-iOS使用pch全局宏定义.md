---
layout: post
title: iOS使用pch全局宏定义
date: 2015-12-02 15:05:00.000000000 +08:00
---
###pch简介
pch文件是一个标准的预编译头文件( Pre-Compiled Header). 在Xcode6之前的版本中，系统模板会在Supporting Files文件夹自动创建。但在Xcode6之后的版本中取消了这一文件，如果我们需要使用pch文件，则需要手动创建。
备注：在pch文件中尽量不要进行头文件引入，虽然这样很省事，但是牺牲的是编译速度。引入头文件可以专门建一个.h文件进行引头。

###手动创建pch
1 .在Supporting Files中新建文件

![新建文件.png](http://upload-images.jianshu.io/upload_images/692407-24c59d0194011dd6.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

 2 .选择pch文件

![PCH文件.png](http://upload-images.jianshu.io/upload_images/692407-8809da370adf490b.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

3 .命名为×××.pch

![命名为×××.pch.png](http://upload-images.jianshu.io/upload_images/692407-96fa1a746811865f.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

4 .配置路径

![修改配置路径.png](http://upload-images.jianshu.io/upload_images/692407-c358e32b0813ad04.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

- 当`Precompile Prefix Header`为`YES`，那么pch会被预编译，预编译后的pch文件会被缓存起来，从而提高编译速度。当 `Precompile Prefix Header` 为`NO`时，那么pch不会被预编译，而是在每一个用到它导入的框架类库的.m文件中编译一次。
- `$(SRCROOT)`代表你工程根目录，无需更改。后面分别是你的项目名称以及你的pch文件名

5 .在pch中写一个宏定义

![一个宏定义.png](http://upload-images.jianshu.io/upload_images/692407-dadfc5a3c86f83fd.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

6 .在VC中可以直接使用

![全局可用的宏定义.png](http://upload-images.jianshu.io/upload_images/692407-9af056a08bb13684.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
