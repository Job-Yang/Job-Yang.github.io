---
layout: post
title: 深入浅出话iOS URL Scheme（一）理论篇
date: 2016-08-22 15:07:00.000000000 +08:00
---

# 

#理论篇
## 什么是URL Scheme？
　　简单的说，由于苹果选择沙盒来保障用户的隐私和安全，App只能访问自己的沙盒，但同时也阻碍了应用间合理的信息共享。所以苹果提供了一个可以在App之间跳转的方法：URL Scheme。如果你的App需要提供一个供别的App访问的功能或者数据，那么你必须在你的App定义一个相对应的URL Scheme。当别的App使用一个URL Scheme进行访问时，系统会根据URL Scheme进行匹配，执行相应的操作。

## 如何理解URL Scheme？
为了更加深入的理解上面的那段话，首先我们清楚几个概念：
1.  URL（Uniform Resoure Locator：统一资源定位器）：也就是我们熟悉的那个“网址”，通过他我们可以访问到我们想要的服务和资源，并且URL可以传递相应的参数；

2.  URL地址格式排列为：`scheme://host:port/path`，举个🌰，`http://www.sohu.com/domain/HXWZ`就是一个典型的URL，而这个网址对应的`Scheme`就是`http`，表示的是一个 URL 中的一个位置——最初始的位置。也可以理解为一种自定义的协议。

3.  根据我们上面对 URL Scheme 的理解，我们可以很轻易地理解，在以本地应用为主的 iOS 上，我们可以像定位一个网页一样，用一种特殊的 URL 来定位一个应用甚至应用里某个具体的功能。而定位这个应用的标识，也就是Scheme。比如微信的Scheme是`weixin`,打开微信扫一扫功能的URL Scheme则是`weixin://dl/scan`。

这样一对比就容易很明白的理解出了URL Scheme的真正含义，它是为了在iOS系统中定位对应的App然后执行对应的操作，复杂的URL Scheme还可以传递参数。

## URL Scheme的应用场景？

1. 使用iOS系统预设的URL Scheme调用系统App：
   iOS系统内置的App，如mail，电话等等，都有相应的URL Scheme供其他的App调用.比如下面的代码就是使用系统的电话App给18888888888打电话。
        [[UIApplication sharedApplication] openURL:[NSURL URLWithString:@"tel://18888888888"]];
   关于其他系统支持的URL Scheme我在此不再赘述。以下是一些Scheme合集:
- [常用iOS URL Scheme附录](http://blog.csdn.net/chenyong05314/article/details/47791023)
- [你所知道好玩有趣的 iOS URL schemes 有哪些](https://www.zhihu.com/question/19907735)

2. 使用URL Scheme让别的应用打开自己的App,自己的App写好一些需要别的App来使用的功能。比如对于支付宝来说，当的App使用支付宝支付功能时，那么这些App就可以使用支付宝定义好的Scheme来访问支付宝的支付功能。

3. 使用第三方App写好的URL Scheme实现一些快捷功能。比如说我是一个工具类App，如果我知道很多App的Scheme，可以直接调用他们的很多功能，实现功能聚合的目的。事实上来说，[Launch Center Pro](http://sspai.com/tag/Launch%20Center%20Pro) 就是基于Scheme来实现快捷方式的。

4. 跨App间的一些交互
   这个其实与第二条类似，但是分开说是因为,假如你们公司有2个以上的App或者你自己开发的多款App，要进行进程间的数据共享或者其他操作，完全可以使用URL Scheme进行一些具有想象力的操作。

5. 进行App间的跳转。在传统意义上的页面跳转，无非也就是以下几种方式：
   - Storyboard的segues方式跳转
   - 直接跳转present，dismiss跳转
   - UINavigationController的push，pop跳转

这些方式其实都有一个缺点，那就是跳转很不灵活，如果想让一个模块根据需求动态的跳转不同页面，传递不同的参数，那么就必须书写很多复杂的逻辑几句一些情况也选择要跳转的逻辑。
或许你说我可以通过控制器的名字来创建对应的控制器进行动态的跳转，但事实上这样的方式如果仅仅进行跳转还是能满足需求的，但是在传递参数方面就是闲的力不从心。
所以说了那么多，有一种跳转方式可以既满足跳转的动态需求，也可以灵活的传递参数。这种方式就是使用URL Scheme进行动态跳转。这也是我非常推荐的一种使用方式。并且在一些组件化开发的尝试中，这种跳转方式也带来了很多便利。

## 使用URL Scheme跳转的好处
1. 这种跳转方式是很灵活的，我本地只需要需要进行简单逻辑处理，使用openURL来打开对应的控制器，而这个你想要打开的URL Scheme是可以动态的从服务器动态获取的。那么这样就很简单的实现了动态跳转。
2. URL Scheme传递参数的方式也与URL一致，只需要简单的在URL里附加上对应的参数即可。
3. 这种页面跳转是无差别的，通过URL Scheme跳转可以无缝的在H5页面和原生页面之间跳转传值，而无非做更多的逻辑判断。

## 使用URL Scheme跳转的缺点
1. 写在info.plist文件中的Scheme可能会被一些反编译手段获取到。
2. URL Scheme可能会被劫持调来安全隐患，比如[支付宝的URL Scheme劫持漏洞](http://www.feng.com/iPhone/news/2015-03-23/Alert-to-iOS-URL-Scheme-can-hijack-payment-password_610511.shtml)。

当然这是避免的,以下引自乌云：
> 1. 苹果可以限制 iOS 应用不能注册别的应用的 Bundle ID 作为 URL Scheme。这样的话，使用自己的 Bundle ID 作为 URL Scheme 的接收器就会变的安全很多。
2. 第三方应用可以通过①给自己发送 URL Scheme 请求来证明没有被劫持，如果没有收到自己的 URL Scheme，就可以及时给用户发送提醒；②利用 MobileCoreServices 服务中的 applicationsAvailableForHandlingURLScheme() 来查看所有注册了该 URL Schemes 的应用和处理顺序，从而检测自己、或者别人的 URL Scheme 是否被劫持。

下一篇写实战。。。。

​