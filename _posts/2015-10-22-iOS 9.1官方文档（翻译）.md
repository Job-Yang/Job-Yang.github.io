---
layout: post
title: iOS 9.1 官方文档（翻译）
date: 2015-10-22 16:39:00.000000000 +08:00
---

###iOS 9.1###
　　本文总结了在iOS 9.1中引入的开发者相关的特性,它运行在目前已推出的iOS设备上。本文还详细的列出文档中描述的新功能。

　　对于最新消息和相关信息，请查看[iOS 9.1发行说明](https://developer.apple.com/library/ios/releasenotes/General/RN-iOSSDK-9.1/index.html#//apple_ref/doc/uid/TP40016570)。对于iOS 9.1中新增的API详细列表，请查看[iOS 9.1 API差异](https://developer.apple.com/library/ios/releasenotes/General/iOS91APIDiffs/index.html)。有关新设备的详细信息，请参阅[iOS设备兼容性参考](https://developer.apple.com/library/ios/documentation/DeviceInformation/Reference/iOSDeviceCompatibility/Introduction/Introduction.html#//apple_ref/doc/uid/TP40013599)。

------------
#####Live Photos#####
　　Live Photos是iOS 9的新功能，可以让用户捕捉和重温自己最喜欢的时刻，比传统的照片更丰富的体验。当用户按下快门按钮时，相机应用会捕获比传统照片更多的内容，包括声音以及照片前后更多帧的内容。当通过这些照片应用浏览时，用户可以与它们进行交互和播放所有拍摄的内容，使照片有着更生动的表现。

　　iOS 9.1引入的API，允许应用程序播放Live Photos，以及导出照片数据用来分享。Photos framework支持从[PHImageManager](https://developer.apple.com/library/ios/documentation/Photos/Reference/PHImageManager_Class/index.html#//apple_ref/occ/cl/PHImageManager)对象来获取[PHLivePhoto](https://developer.apple.com/library/ios/documentation/Photos/Reference/PHLivePhoto_Class/index.html#//apple_ref/occ/cl/PHLivePhoto)对象,用于代表Live Photos的所有数据。你可以使用[PHLivePhotoView](https://developer.apple.com/library/ios/documentation/PhotosUI/Reference/PHLivePhotoView_Class/index.html#//apple_ref/occ/cl/PHLivePhotoView)对象（在PhotosUI framework中定义）来显示的Live Photos的内容。PHLivePhotoView视图负责显示图像,处理所有的用户交互,以及播放可视化处理后的内容。

　　你还可以使用[PHAssetResource](https://developer.apple.com/library/ios/documentation/Photos/Reference/PHAssetResource_Class/index.html#//apple_ref/occ/cl/PHAssetResource)访问[PHLivePhoto](https://developer.apple.com/library/ios/documentation/Photos/Reference/PHLivePhoto_Class/index.html#//apple_ref/occ/cl/PHLivePhoto)对象的数据以达到共享的目的。你可以请求一个PHLivePhoto对象作为资产在用户的图库中使用[PHImageManager](https://developer.apple.com/library/ios/documentation/Photos/Reference/PHImageManager_Class/index.html#//apple_ref/occ/cl/PHImageManager)或[UIImagePickerController](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UIImagePickerController_Class/index.html#//apple_ref/occ/cl/UIImagePickerController)。如果你有一个共享扩展，您还可以使用[NSItemProvider](https://developer.apple.com/library/ios/documentation/Foundation/Reference/NSItemProvider_Class/index.html#//apple_ref/occ/cl/NSItemProvider)得到PHLivePhoto对象。在共享的接收端，你可以从发送者的文件最初导出集合重新创建PHLivePhoto对象。

　　Live Photos导出的数据在[PHAssetResource](https://developer.apple.com/library/ios/documentation/Photos/Reference/PHAssetResource_Class/index.html#//apple_ref/occ/cl/PHAssetResource)对象中以文件集合的形式存在。当你上传到服务器时，必须将数据集合作为一个单元。当你与接收短端重建[PHLivePhoto](https://developer.apple.com/library/ios/documentation/Photos/Reference/PHLivePhoto_Class/index.html#//apple_ref/occ/cl/PHLivePhoto)文件,必须验证这些文件。如果文件不是来自相同的资产，则加载失败。

　　要了解如何在你的应用中给用户更完美的Live Photos用户体验，请查看[Live Photos](https://developer.apple.com/library/ios/documentation/UserExperience/Conceptual/MobileHIG/LivePhotos.html#//apple_ref/doc/uid/TP40006556-CH74)。

--------

#####支持Apple Pencil#####
　　iOS 9.1引入的API,帮助你使用合并和预测触摸可以支持Apple Pencil的设备。具体来说,[UITouch](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/cl/UITouch)类包括:

- [preciseLocationInView:](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/instm/UITouch/preciseLocationInView:) 和 [precisePreviousLocationInView:](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/instm/UITouch/precisePreviousLocationInView:)方法,可以获得触摸的精确位置(如果可用)
- [altitudeAngle](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/instp/UITouch/altitudeAngle)属性与[azimuthAngleInView:](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/instm/UITouch/azimuthAngleInView:) 和 [azimuthUnitVectorInView:](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/instm/UITouch/azimuthUnitVectorInView:)方法，帮助你确定手写笔的高度和方位角
- [estimatedProperties](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/instp/UITouch/estimatedProperties)和[estimatedPropertiesExpectingUpdates](https://developer.apple.com/library/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/instp/UITouch/estimatedPropertiesExpectingUpdates)属性，帮助你准备更新预计触摸
- UITouchTypeStylus常数用于表示从一个手写笔接收的触摸

　　为了更好利用这些API的到你的应用程序中，请查看[TouchCanvas:高效运用UITouch](https://developer.apple.com/library/ios/samplecode/TouchCanvas/Introduction/Intro.html#//apple_ref/doc/uid/TP40016561)。要了解如何添加3D Touch segues你视图中，请查看[添加3D Touch segues](https://developer.apple.com/library/ios/recipes/xcode_help-IB_storyboard/Chapters/Add3DSegue.html#//apple_ref/doc/uid/TP40014225-CH52)。

-----------
原文地址：[iOS 9.1官方文档](https://developer.apple.com/library/ios/releasenotes/General/WhatsNewIniOS/Articles/iOS9_1.html#//apple_ref/doc/uid/TP40016572-SW1)
