---
layout: post
title: iOS 9.2 官方文档（翻译）
date: 2016-01-15 17:08:00.000000000 +08:00
---
###iOS 9.2###
　　本文总结了在iOS 9.2中引入的开发者相关的特性,它运行在目前已推出的iOS设备上。本文还详细的列出文档中描述的新功能。

　　对于最新消息和相关信息，请查看[iOS 9.2发行说明](https://developer.apple.com/library/ios/releasenotes/General/RN-iOSSDK-9.2/index.html#//apple_ref/doc/uid/TP40016638)。对于iOS 9.2中新增的API详细列表，请查看[iOS 9.2 API差异](https://developer.apple.com/library/ios/releasenotes/General/iOS92APIDiffs/index.html)。有关新设备的详细信息，请参阅[iOS设备兼容性参考](https://developer.apple.com/library/ios/documentation/DeviceInformation/Reference/iOSDeviceCompatibility/Introduction/Introduction.html#//apple_ref/doc/uid/TP40013599).

------------

#####CloudKit Framework#####

　　CloudKit Framework包括以下增强功能：
　　[CKFetchWebAuthTokenOperation](https://developer.apple.com/library/ios/documentation/CloudKit/Reference/CKFetchWebAuthTokenOperation_class/index.html#//apple_ref/occ/cl/CKFetchWebAuthTokenOperation)类提供了一个对象，当你给它一个API token时，你可以用它来获得一个网络身份验证token。


#####WatchKit Framework#####

　　WatchKit Framework包括以下增强功能：
　　[WKInterfaceDevice](https://developer.apple.com/library/ios/documentation/WatchKit/Reference/WKInterfaceDevice_class/index.html#//apple_ref/occ/cl/WKInterfaceDevice)类支持从右到左语言（right-to-left languages），包括获取设备的布局方向（使用WKInterface的layoutDirection），并控制内容是否应翻转为从右到左的语言（使用WKInterfaceSemanticContentAttribute）。

----------
原文地址：[iOS 9.2官方文档](https://developer.apple.com/library/ios/releasenotes/General/WhatsNewIniOS/Articles/iOS9_2.html#//apple_ref/doc/uid/TP40016637-SW1)
