---
layout: post
title: iOS 9官方文档（翻译）
date: 2015-09-29 10:12:00.000000000 +08:00
---

# iOS 9官方文档（翻译）



**       iOS9已经发布一段时间了,我也在最近升级了Xcdoe 7.0正式版，升级后才发现又有了很多奇妙的变化，于是查看官方文档的一些解释，顺便做了一些翻译，和大家分享一下（转载请注明出处）。**

* * *

# iPad多任务增强

      iOS9增强了对iPad用户的多任务处理如滑动覆盖（Slide Over），分割视图（Split View）和画中画（Picture in Picture）的体验。该滑过功能允许用户选择一个次要的App并快速地与之交互。分割视图功能让用户能够同时并排开启两个App。画中画功能(也称为PiP)允许用户观看视频的一个窗口上面浮动其他屏幕上的App。

        **你没有办法帮助用户决定他们什么时候想在屏幕的同时显示两个App，因为这一切都是用户行为你无法控制。尽管如此，我们还需要做一下几件事，来确保用户有一个完美的多任务处理的体验。**

      1\. 非常重要的是，你的App必须合理地利用的系统资源，以便他可以有效地运行一个App的同时，还可以与正常的运行另一个App。根据内存压力,系统预先退出消耗最大内存的App。有关应用能耗的一些问题，请参阅[iOS App能耗指南](https://developer.apple.com/library/prerelease/ios/documentation/Performance/Conceptual/EnergyGuide-iOS/index.html#//apple_ref/doc/uid/TP40015243)。

      2\. 如果你还没有准备拥抱iOS 9所带来的变化，那么一定要采用SizeClasses，使你的App在分屏视图下看起来不错。

      想了解更多关于你的App应当如何响应用户的分割视图与滑动覆盖，请参考[iPad多任务增强](https://developer.apple.com/library/prerelease/ios/documentation/WindowsViews/Conceptual/AdoptingMultitaskingOniPad/index.html#//apple_ref/doc/uid/TP40015145)。

      与分割视图,滑动覆盖一样,用户控制他们是否在看视频的同时以画中画的形式启动另一个应用程序来运行。如果视频播放不是你的应用程序的主要功能，那么请支持画中画。

     当用户选择画中画，使用AVKit或者AV Foundation的API。视频播放类中定义的不支持画中画的媒体播放器框架在iOS9中将会被弃用。要了解如何准备画中画视频播放的应用程序，请参看[画中画快速指南](https://developer.apple.com/library/prerelease/ios/documentation/WindowsViews/Conceptual/AdoptingMultitaskingOniPad/QuickStartForPictureInPicture.html#//apple_ref/doc/uid/TP40015145-CH14)。

* * *

# 3D Touch

      3D Touch给用户带来了更多的交互维度。在支持的3D Touch设备上，用户可以从主屏幕上按压App图标可以快速选择App特定的操作。在一个应用程序，人们可以使用按压操作来获得一个项目的预览，在一个单独的视图中打开该项目，并响应相应的操作。

      **iOS9提供了以下的3D Touch的API：**

      1\. 主屏幕快速响应API提供了添加快捷方式到你的应用程序图标,预测用户行为并提供更加快捷的人机交互(参看 UIApplicationShortcut * API,例如[UIApplicationShortcutItem](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIApplicationShortcutItem_class/index.html#//apple_ref/occ/cl/UIApplicationShortcutItem))。

      2\. UIKit中的peek和pop API让你能够轻松地获得额外的内容在你的App(参看[UIViewControllerPreviewing](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIViewControllerPreviewing_Protocol/index.html#//apple_ref/occ/intf/UIViewControllerPreviewing)，[UIViewControllerPreviewingDelegate](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIViewControllerPreviewingDelegate_Protocol/index.html#//apple_ref/occ/intf/UIViewControllerPreviewingDelegate)以及[UIViewController](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIViewController_Class/index.html#//apple_ref/occ/cl/UIViewController)中新的方法)。使用peek快速响应API中提供一个press-enabled替换应用程序的touch-and-hold方法(参看 UIPreview * API,例如[UIPreviewAction](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIPreviewAction_Class/index.html#//apple_ref/occ/cl/UIPreviewAction)和[UIPreviewActionItem](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIPreviewActionItem_Protocol/index.html#//apple_ref/occ/intf/UIPreviewActionItem))。

      3\. Web视图peek和pop API,可以启用的HTML链接的预览信息（参看 [WKWebView](https://developer.apple.com/library/prerelease/ios/documentation/WebKit/Reference/WKWebView_Ref/index.html#//apple_ref/occ/cl/WKWebView)）。

      4. [UITouch](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UITouch_Class/index.html#//apple_ref/occ/cl/UITouch)中的force属性允许你添加自定义的force-based到你的App的用户交互中。

      不管你采用哪些API，你的App必须在runtime时检查3D Touch的可用性。要了解更多关于支持3D Touch，参看[在iPhone上使用3D Touch](https://developer.apple.com/library/prerelease/ios/documentation/UserExperience/Conceptual/Adopting3DTouchOniPhone/index.html#//apple_ref/doc/uid/TP40016543)。对于你的应用程序中使用3D Touch API的例子，参看[ApplicationShortcuts中使用UIApplicationShortcutItem](https://developer.apple.com/library/prerelease/ios/samplecode/ApplicationShortcuts/Introduction/Intro.html#//apple_ref/doc/uid/TP40016545)和[ViewControllerPreviews中使用的UIViewController previewing API](https://developer.apple.com/library/prerelease/ios/samplecode/ViewControllerPreviews/Introduction/Intro.html#//apple_ref/doc/uid/TP40016546)。

* * *

# 搜索

      搜索（Search）在iOS 9中赋予了用户更加出色的方式来访问你的App内部信息,即使它没有安装（Installed）。当你的内容是可搜索状态时，用户可以通过Spotlight,Safari,Siri在你的App里访问活动（Activities）及其深度内容（Content Deep）。使用搜索的相关API，决定内容索引(Indexed)情况，即在搜索结果中显示什么信息，用户从你的App或者网站获得重定向后的结果。

      在iOS 9中整合搜索内容其实很简单：你在执行搜索时不需要任何之前的经验，并且大多数开发者发现，只需要几个小时，使他们的内容可以普遍的成为可搜索的状态。要了解如何让你的应用App和网站内容的可搜索，参看[App搜索编程指南](https://developer.apple.com/library/prerelease/ios/documentation/General/Conceptual/AppSearch/index.html#//apple_ref/doc/uid/TP40016308)。

    **在iOS 9中使用搜索时，隐私是一个重要的特性。给用户最好的搜索体验的同时,也保护他们的**隐私**数据,iOS 9提供了以下可用索引:**

     1\. 私有的设备索引(A private on-device index)。每个设备包含一个私有索引，该信息不会与Apple设备间共享或同步。当你创建一个项目可以在用户的设备索引时,保证只有该用户可以查看搜索结果。

    2\. Apple的服务器端索引(Apple’s server-side index)。服务器端的索引只存储你已经适当地在网站上标明的公开数据。

    **iOS 9提供了以下API来帮助你进行内容搜索：**

     1. [NSUserActivity](https://developer.apple.com/library/prerelease/ios/documentation/Foundation/Reference/NSUserActivity_Class/index.html#//apple_ref/occ/cl/NSUserActivity)类包括新的方法和属性，可以帮助你构建项目索引等用户执行的活动内容，例如访问一个导航点或创建和查看内容。几乎每一个App可以利用NSUserActivity API，提供有用的内容给用户。

    2\. Core Spotlight framework（CoreSpotlight.framework）提供的API，可以帮你添加App的特定内容到设备上的索引，并启用深层链接到你的App。要了解更多关于Core Spotlight framework API，参看[Core Spotlight framework参考](https://developer.apple.com/library/prerelease/ios/documentation/CoreSpotlight/Reference/CoreSpotlight_Framework/index.html#//apple_ref/doc/uid/TP40016250)。

    3\. Web markup可以让你相关的网页内容成为可搜索状态，并帮助你丰富用户的搜索体验。要了解如何标记你的网站，参看[标记网页内容](https://developer.apple.com/library/prerelease/ios/documentation/AppleApplications/Reference/SafariWebContent/PromotingAppswithAppBanners/PromotingAppswithAppBanners.html#//apple_ref/doc/uid/TP40002051-CH6)。

    此外，加入了Smart App Banners为用户提供了一种简单的方法，直接链接到你的应用程序（了解如何使用Smart App Banners，参看[App与Smart App Banners](https://developer.apple.com/library/prerelease/ios/documentation/AppleApplications/Reference/SafariWebContent/PromotingAppswithAppBanners/PromotingAppswithAppBanners.html#//apple_ref/doc/uid/TP40002051-CH6)）。

    4\. 通用链接（Universal Links），让你使用标准的HTTP或HTTPS链接替换自定义URL方案。通用链接适用于所有用户：如果用户已经安装了你App，链接直接带他们到你的App;如果他们没有安装您的App，链接将会在Safari中打开你的网站。要了解更多关于通用链接，参看[通用链接](https://developer.apple.com/library/prerelease/ios/documentation/General/Conceptual/AppSearch/UniversalLinks.html#//apple_ref/doc/uid/TP40016308-CH12)。

* * *

# 游戏

      iOS 9包括一些技术改进，使它更容易实现你的游戏图形和音频功能。充分利用高层框架易于开发、或使用新的底层增强功能利用GPU的性能。

####      **GameplayKit**

GameplayKit framework（GameplayKit.framework）提供了基础技术用于构建游戏。使用GameplayKit机制开发游戏，并配合任何一个高级图形引擎，如SceneKit或SpriteKit，建立一个完整的游戏。该框架提供构建模块，用于创建游戏的模块化架构，其中包括：

    1\. 随机工具（Randomization Tool）用于添加一个不可预测的但又不影响调试的游戏。

    2\. 实体-组件（Entity-Componen）架构设计的游戏代码重用性更好。

    3\. 状态机（State Machine）在游戏系统中可以避免复杂的程序代码。

      GameplayKit还包括常见的游戏算法的标准实现，这样你就可以花更少的时间阅读官方文档，花更多的时间去研究你的游戏机制，而不是把时间浪费到其他重复的工作上。在GameplayKit中几个标准算法的实现列表如下。

    1\. 回合制人工智能对抗游戏中的上下限(Minmax)。

    2\. 代理模拟(Agent simulation)，让你描述的高层次目标的条件运动行为进行自动跟随。 

    3\. 规则系统用于构建数据驱动（data-driven）游戏的逻辑、模糊推理以及自发行为。

    想了解更多关于 GameplayKit, 参看 [GameplayKit编程指南](https://developer.apple.com/library/prerelease/ios/documentation/General/Conceptual/GameplayKit_Guide/index.html#//apple_ref/doc/uid/TP40015172)和[GameplayKit Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/GameplayKit/Reference/GameplayKit_Framework/index.html#//apple_ref/doc/uid/TP40015199),以及GameplayKit示例代码：

    1.[FourInARow: Using the GameplayKit Minmax Strategist for Opponent AI](https://developer.apple.com/library/prerelease/ios/samplecode/FourInARow/Introduction/Intro.html#//apple_ref/doc/uid/TP40016142).

    2\.  [AgentsCatalog: Using the Agents System in GameplayKit](https://developer.apple.com/library/prerelease/ios/samplecode/AgentsCatalog/Introduction/Intro.html#//apple_ref/doc/uid/TP40016141).

    3\.  [DemoBots: Building a Cross Platform Game with SpriteKit and GameplayKit](https://developer.apple.com/library/prerelease/ios/samplecode/DemoBots/Introduction/Intro.html#//apple_ref/doc/uid/TP40015179).

<a href="" target="_blank"></a>

<a href="" target="_blank"></a>

####    Model I/O

    Model I/O framework（ModelIO.framework）提供了一个系统级的3D Model Assets和相关资源。可以使用此框架处理几种类型的任务，如：

    1\. 从流行的编辑软件和游戏引擎所使用的文件格式中导入网格数据（Mesh Data）、材料描述（Material Descriptions）、照明（Lighting）和相机设置（Camera Setting）以及其他场景信息。

    2\. 处理或产生这样的数据， 例如，烘培(Bake)照明信息成网状，或创建程序天空的纹理。

    3\. 将MetalKit，GLKit，SceneKit的API，有效装载资产数据到GPU的缓冲区一起进行渲染。

    4\. 以任何一种文件格式导出处理或产生的资产数据。

    要想了解更多关于 Model I/O，参看[Model I/O Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/ModelIO/Reference/ModelIO_Framework/index.html#//apple_ref/doc/uid/TP40015421)。

####      MetalKit

      MetalKit framework（MetalKit.framework）提供了一组实用方法和类，减少创建Metal App所需的工作。 MetalKit提供了三个关键领域开发支持：

    1\. 纹理加载帮助你的App轻松且异步加载各种来源的纹理。支持常见的文件格式如PNG和JPEG，以及特定的纹理格式如KTX和PVR。

    2.  Model的处理提供了Metal-Specific功能，可以很容易与Model I/O资源对接。使用这些高度优化的功能和对象在Model I/O网格和Metal缓冲区之间高效地传输数据。

    3\. View Management提供了Metal View标准的实现，这大幅的降低了创建一个图形渲染App所需的代码量。

    想了解更多关于MetalKit的API，参看[MetalKit Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/MetalKit/Reference/MTKFrameworkReference/index.html#//apple_ref/doc/uid/TP40015356)，更多关于Metal的基本信息，参看[Metal编程指南](https://developer.apple.com/library/prerelease/ios/documentation/Miscellaneous/Conceptual/MetalProgrammingGuide/Introduction/Introduction.html#//apple_ref/doc/uid/TP40014221)，[Metal Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/Metal/Reference/MetalFrameworkReference/index.html#//apple_ref/doc/uid/TP40014161)，[Metal着色指南](https://developer.apple.com/library/prerelease/ios/documentation/Metal/Reference/MetalShadingLanguageGuide/Introduction/Introduction.html#//apple_ref/doc/uid/TP40014364)

####      Metal 性能着色器

      Metal Performance Shaders framework（MetalPerformanceShaders.framework）提供了高度优化的计算和图形着色器，轻松高效地集成到你的Metal App上。这些数据并行着色器(Data-Parallel Shaders)进行了专门调整，以充分利用每一个Metal支持的iOS GPU独特的硬件优势。

      使用Metal Performance Shader类，可以实现对所有支持的硬件发挥最佳的性能，而无需针对特定的iOS GPU更新你的着色器代码。 MetalPerformanceShader对象完美融入你的Metal的App，并可以使用Metal resource对象，例如缓冲区和纹理使用。

      常见的Metal Performance Shaders framework包括：

     1\. 高斯模糊（Gaussian blur）——[MPSImageGaussianBlur](https://developer.apple.com/library/prerelease/ios/documentation/MetalPerformanceShaders/Reference/MPSImageGaussianBlur_ClassReference/index.html#//apple_ref/occ/cl/MPSImageGaussianBlur)。

     2\. 图像直方图（Image histogram）——[MPSImageHistogram](https://developer.apple.com/library/prerelease/ios/documentation/MetalPerformanceShaders/Reference/MPSImageHistogram_ClassReference/index.html#//apple_ref/occ/cl/MPSImageHistogram)。

     3\. Sobel边缘检测（Sobel edge detection）——[MPSImageSobel](https://developer.apple.com/library/prerelease/ios/documentation/MetalPerformanceShaders/Reference/MPSImageSobel_ClassReference/index.html#//apple_ref/occ/cl/MPSImageSobel)。

####     Metal 新特性

     Metal framework（Metal.framework）增加了新的功能，使你的图形渲染的App看起来更棒，且拥有更高性能。这些功能包括：

    1\. 改进了Metal着色语言和Metal标准库。

    2\. 计算着色器现在可以写更广泛的像素格式。

    3\. 加入私人和深度模板纹理，以配合OS X。

    4\. 增加Depth Clamping以及独立的正面和背面模板参考值以改善阴影质量。

####    SceneKit 新特性

    SceneKit framework（SceneKit.framework）在iOS9中的新特性包括：

    1\. Metal渲染的支持。参看[SCNView](https://developer.apple.com/library/prerelease/ios/documentation/SceneKit/Reference/SCNView_Class/index.html#//apple_ref/occ/cl/SCNView)和[SCNSceneRenderer](https://developer.apple.com/library/prerelease/ios/documentation/SceneKit/Reference/SCNSceneRenderer_Protocol/index.html#//apple_ref/occ/intf/SCNSceneRenderer)类在支持的设备上实现Metal高性能的渲染。

    2\. Xcode中新场景编辑器。在Xcode新场景编辑器下以更少的代码，更短的时间构建游戏和交互式3D App（相关示例代码下载  [Fox: Building a SceneKit Game with the Xcode Scene Editor](https://developer.apple.com/library/prerelease/ios/samplecode/Fox/Introduction/Intro.html#//apple_ref/doc/uid/TP40016154)）。

    3\. 定位音频。参看[SCNAudioPlayer](https://developer.apple.com/library/prerelease/ios/documentation/SceneKit/Reference/SCNAudioPlayer_Class/index.html#//apple_ref/occ/cl/SCNAudioPlayer)和[SCNNode](https://developer.apple.com/library/prerelease/ios/documentation/SceneKit/Reference/SCNNode_Class/index.html#//apple_ref/occ/cl/SCNNode)类，该类可以自动跟踪场景中的听众位置，以增加空间的音频效果。

    更多的细节和新功能，参看[SceneKit Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/SceneKit/Reference/SceneKit_Framework/index.html#//apple_ref/doc/uid/TP40012283)。

####    SpriteKit 新特性

    SpriteKit framework（SpriteKit.framework）在iOS9中的新特性包括：

    1.Metal渲染的支持。在支持Metal设备自动使用Metal渲染，即使你使用自定义的OpenGL ES着色器。

    2.改进场景编辑器，并在Xcode中加入新的动作编辑器。以更少的代码，更短的时间构建游戏和交互式2D App（相关示例代码下载   [DemoBots: Building a Cross Platform Game with SpriteKit and GameplayKit](https://developer.apple.com/library/prerelease/ios/samplecode/DemoBots/Introduction/Intro.html#//apple_ref/doc/uid/TP40015179)）。

    3.摄像机节点（即[SKCameraNode](https://developer.apple.com/library/prerelease/ios/documentation/SpriteKit/Reference/SKCameraNode/index.html#//apple_ref/occ/cl/SKCameraNode)对象），使其更容易创建scrolling games。简单地将相机节点放入你的场景中并设置摄像头的属性。

    4.定位音频。了解如何添加空间音频效果且自动跟踪场景中的听众位置，参看 [SKAudioNode类参考](https://developer.apple.com/library/prerelease/ios/documentation/SpriteKit/Reference/SKAudioNode/index.html#//apple_ref/doc/uid/TP40015249)。

    更多的细节和新功能，参看[SpriteKit Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/SpriteKit/Reference/SpriteKitFramework_Ref/index.html#//apple_ref/doc/uid/TP40013041)。

* * *

# 应用瘦身(App Thinning)

      应用瘦身帮助你开发不同的平台的App提供一个优化的自动安装。应用瘦身包括以下内容：

      1\. Slicing。纳入资产目录，并为平台标记一个只允许App Store提供安装的标记。

      2\. 按需加载资源（On-Demand Resources）。主机允许附加内容存储在iTunes App Store库中的App获取所需的资源使用异步下载和安装。更多地了解这项技术，参看 [按需加载资源指南](https://developer.apple.com/library/prerelease/ios/documentation/FileManagement/Conceptual/On_Demand_Resources_Guide/index.html#//apple_ref/doc/uid/TP40015083)。

    3\. Bitcode。当我们提交程序到App store上时，Xcode会将程序编译为一个中间表现形式(bitcode)。然后App store会再将这个botcode编译为可执行的64位或32位程序。

      要了解更多有关应用瘦身，参看 [应用瘦身（iOS, watchOS）](https://developer.apple.com/library/prerelease/ios/documentation/IDEs/Conceptual/AppDistributionGuide/AppThinning/AppThinning.html#//apple_ref/doc/uid/TP40012582-CH35)。

* * *

# 支持从右到左（RTL）语言

       iOS的9带来了从右到左的语言全面的支持，这使得它更容易为你提供一个翻转的用户界面。 例如：

      1\. 标准UIKit的控件右到左的上下文自动翻转。

      2.[UIView](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIView_Class/index.html#//apple_ref/occ/cl/UIView)定义语义内容属性允许你指定在从右到左的上下文中特定的视图应该如何出现。

      3.[UIImage](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIImage_Class/index.html#//apple_ref/occ/cl/UIImage)添加[imageFlippedForRightToLeftLayoutDirection](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIImage_Class/index.html#//apple_ref/occ/instm/UIImage/imageFlippedForRightToLeftLayoutDirection)方法，该方法可以很容易地在适当时候以编程方式的翻转图像。

      要了解更多关于翻转的用户接口，参看 [支持从右到左（RTL）语言](https://developer.apple.com/library/prerelease/ios/documentation/MacOSX/Conceptual/BPInternational/SupportingRight-To-LeftLanguages/SupportingRight-To-LeftLanguages.html#//apple_ref/doc/uid/10000171i-CH17)。

* * *

# 应用安全传输（ATS）

      强制使用应用安全传输（ATS）是应用程序和后端之间的安全连接的最佳做法。 ATS防止意外泄露，提供安全的默认行为，并且容易被采纳。这也是iOS 9和OS X v10.11中默认开启的。不管你正在创建一个新的App或者正在更新现有的App，你都应当尽快采用ATS。

      如果你正在开发一个新的应用程序，你应当考虑只使用更安全的HTTPS协议。如果你有一个现有的App，从现在开始你应该尽可能多使用HTTPS协议，尽快给应用剩余部分制定迁移计划。此外，通过高级API的通信需要使用TLS 1.2与前向保密（forward secrecy）。如果你不这样做，则会报错。如果你的应用程序需要请求不安全的域名，那么你必须在Info.plist文件中指定这一域名。

* * *

# 扩展点（Extension Points）

      iOS 9引入了一些新的扩展点（一个扩展点定义了使用规则和提供api来使用当您创建一个应用程序扩展区域）。具体做法是：

####    **网络（Network）扩展点:**

    1\. 使用包隧道提供者（Packet Tunnel Provider）扩展点来实现客户端定制的VPN隧道协议。

    2\. 使用这个应用程序代理提供者（App Proxy Provider）扩展点来实现一个自定义的客户端透明的网络代理协议。

    3\. 使用过滤数据提供者（Filter Data Provider）和过滤器控制提供者（Filter Control Provider）扩展点来实现动态、设备内置网络内容过滤。

    每个网络的扩展点都需要从Apple获得特别许可。

####    ** Safari 扩展点**

     1\. 使用共享的链接扩展点，使用户能够看到在Safari共享链接的内容。

     2\. 使用内容阻止扩展点给 Safari 阻止列表，描述你希望在用户在浏览网页阻止的内容。

     **索引维护（Index Maintenance）扩展点来支持应用数据的编制索引，而无需启动App。**

**    音频单元扩展点让你的App提供的乐器，声音效果，声音发生器，这些更多的使用在像GarageBand，Logic，以及其他音频单位（Audio Units）App。扩展点也为**iOS**带来了一个完整的音频插件模型，让你在App Store上销售的自己的**音频单位（Audio Units）。**
**

    像了解更多关于创建应用程序扩展，参看 [App扩展编程指南](https://developer.apple.com/library/prerelease/ios/documentation/General/Conceptual/ExtensibilityPG/index.html#//apple_ref/doc/uid/TP40014214)。

* * *

# 联系人（Contacts）和联系人界面（Contacts UI）

      iOS 9引入了联系人和联系人UI framework（Contacts.framework和ContactsUI.framework）,它提供了现代的面向对象化的替代地址簿（Address Book）和地址簿UI framework。要了解更多信息，参看[Contacts Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/Contacts/Reference/Contacts_Framework/index.html#//apple_ref/doc/uid/TP40015328) 和 [ContactsUI Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/ContactsUI/Reference/ContactsUI_Framework/index.html#//apple_ref/doc/uid/TP40016207)。

* * *
# Watch 连接


Watch Connectivity framework（WatchConnectivity.framework）提供了iPhone和配对Apple Watch之间的双向通信。该框架用于你的iOS应用和相对应的Watch应用之间的协调活动。该框架支持App在运行、后台以及其他情况下的即时通讯（immediate messaging）。要了解更多信息，请参看[Watch Connectivity Framework参考](https://developer.apple.com/library/prerelease/ios/documentation/WatchConnectivity/Reference/WatchConnectivity_framework/index.html#//apple_ref/doc/uid/TP40015269)**。**

* * *

# 钥匙串（Keychain)
****

**    钥匙串（****Keychain****）提供了更多的项目保护选项和一个新型Secure Enclave的加密密钥。具体做法是：**

    1.新的访问控制列表约束，允许创建约束只有Touch ID或只有密码。

     2.新的Touch ID无效的钥匙串项目约束，当指纹被添加或删除时。

    3.支持App-Provided Entropy 密钥链项加密使用App密码访问控制列表的选项。

    4.支持身份验证上下文(Context),允许你分开调用身份验证SecItem Calls。

    5.支持密钥生成和使用中Secure Enclave的kSecAttrTokenIDSecureEnclave属性。需要注意的是获得这些密钥可以通过访问控制列表支持的所有限制进行控制。

* * *

# Swift增强

想了解更多Swift的新功能，参看 [Swift Language](https://developer.apple.com/library/prerelease/ios/documentation/DeveloperTools/Conceptual/WhatsNewXcode/Articles/xcode_7_0.html#//apple_ref/doc/uid/TP40015242-SW2).

* * *

# 额外的Framework变化

     除了上述的大的变化，iOS 9包括许多其他的改进。

#### **    AV Foundation Framework
**

AV Foundation Framework（AVFoundation.framework）增加了新的[AVSpeechSynthesisVoice](https://developer.apple.com/library/prerelease/ios/documentation/AVFoundation/Reference/AVSpeechSynthesisVoice_Ref/index.html#//apple_ref/occ/cl/AVSpeechSynthesisVoice) API，它使你可以通过标识指定的声音，而不是按语言。您也可以使用name和quality属性来获取语音信息。

####     **AVKit Framework**

     AVKit Framework（AVKit.framework）引入了AVPictureInPictureController和AVPlayerViewController类，这有助于你参加画中画。有关画中画的更多信息，向前参看 iPad多任务增强。

####     **CloudKit Framework**

**&nnbsp;  ** 如果你有CloudKit App,你可以使用CloudKit web服务或CloudKit JS JavaScript库,为用户提供一个web界面访问你的App相同的数据。你必须有已经创建的数据库使用web界面来实现取回（Fetch）,创建（Create）、更新（Update）和删除记录（Delete Records）,区域（Zones）,和订阅（Subscriptions）。有关更多信息,请参看[CloudKit JS参考](https://developer.apple.com/library/prerelease/ios/documentation/CloudKitJS/Reference/CloudKitJavaScriptReference/index.html#//apple_ref/doc/uid/TP40015359)，[CloudKit Web服务](https://developer.apple.com/library/prerelease/ios/documentation/DataManagement/Conceptual/CloutKitWebServicesReference/Introduction/Introduction.html#//apple_ref/doc/uid/TP40015240)，[CloudKit介绍](https://developer.apple.com/library/prerelease/ios/samplecode/CloudAtlas/Introduction/Intro.html#//apple_ref/doc/uid/TP40014599)。

####     **Foundation Framework**

Foundation框架（Foundation.framework）包括以下增强功能：

     1\. API，用于按需加载（On-Demand）的一个[NSBundle](https://developer.apple.com/library/prerelease/ios/documentation/Cocoa/Reference/Foundation/Classes/NSBundle_Class/index.html#//apple_ref/occ/cl/NSBundle)资源。

     2.字符串文件支持上下文相关（Context-Dependent）的可变宽字符串。

     3\. [NSProcessInfo](https://developer.apple.com/library/prerelease/ios/documentation/Cocoa/Reference/Foundation/Classes/NSProcessInfo_Class/index.html#//apple_ref/occ/cl/NSProcessInfo) API，用于电源和散热管理。

####     HealthKit Framework

     HealthKit Framework（HealthKit.framework）包括以下增强功能：

    1.新的Tracking Areas支持生殖健康和紫外线照射等领域。学习新的常数描述特征(Describe Characteristics)、数量(Quantities)、和其他项目,参看[HealthKit常量参考](https://developer.apple.com/library/prerelease/ios/documentation/HealthKit/Reference/HealthKit_Constants/index.html#//apple_ref/doc/uid/TP40014710)。

    2.支持新的批量删除(Bulk-Deleting)条目与Tracking删除条目。想了解更多信息，请参看[HKHealthStore](https://developer.apple.com/library/prerelease/ios/documentation/HealthKit/Reference/HKHealthStore_Class/index.html#//apple_ref/occ/instm/HKHealthStore/deleteObjectsOfType:predicate:withCompletion:)类中[HKDeletedObject](https://developer.apple.com/library/prerelease/ios/documentation/HealthKit/Reference/HKDeletedObject_ClassReference/index.html#//apple_ref/occ/cl/HKDeletedObject)[HKAnchoredObjectQuery](https://developer.apple.com/library/prerelease/ios/documentation/HealthKit/Reference/HKAnchoredObjectQuery_Class/index.html#//apple_ref/occ/cl/HKAnchoredObjectQuery)、[deleteObjects:withCompletion:](https://developer.apple.com/library/prerelease/ios/documentation/HealthKit/Reference/HKHealthStore_Class/index.html#//apple_ref/occ/instm/HKHealthStore/deleteObjects:withCompletion:),[deleteObjectsOfType:predicate:withCompletion:](https://developer.apple.com/library/prerelease/ios/documentation/HealthKit/Reference/HKHealthStore_Class/index.html#//apple_ref/occ/instm/HKHealthStore/deleteObjectsOfType:predicate:withCompletion:)和[deleteObjectsOfType:predicate:withCompletion:](https://developer.apple.com/library/prerelease/ios/documentation/HealthKit/Reference/HKHealthStore_Class/index.html#//apple_ref/occ/instm/HKHealthStore/deleteObjectsOfType:predicate:withCompletion:)方法。

####     Local Authentication Framework

     Local Authentication Framework（LocalAuthentication.framework）包括以下增强功能：

     1.得到当前的一组登记的指纹，当手指被登记或删除时，应用程序可以改变行为。

     2.支持从代码取消用户提示。

    3.支持评估钥匙串访问控制列表，并在钥匙串调用中使用的认证上下文(Authentication Context)。

    4.支持可重用的Touch ID匹配。一个之前的手机解锁匹配可以使用evaluateaccesscontrol：和[evaluatePolicy:localizedReason:reply:](https://developer.apple.com/library/prerelease/ios/documentation/LocalAuthentication/Reference/LAContext_Class/index.html#//apple_ref/occ/instm/LAContext/evaluatePolicy:localizedReason:reply:)方法。

####     MapKit Framework

     MapKit Framework（MapKit.framework）包括一些补充，可以帮助你提供更丰富的用户体验。具体做法是：

     1\. MapKit支持公交查询并在Map上显示公交线路。

     2.地图视图(Map View)支持了3D Flyover模式。

     3.注释(Annotations)可以完全定制。

     4.搜索MapKit和[CLGeocoder](https://developer.apple.com/library/prerelease/ios/documentation/CoreLocation/Reference/CLGeocoder_class/index.html#//apple_ref/occ/cl/CLGeocoder)结果可以提供的相应时区。

####     PassKit Framework

     PassKit Framework（PassKit.framework）包括一些关于增强Apple Pay的补充，具体做法是：

    1.在iOS 9中，Apple Pay支持查询存储借记卡(Store Debit)和信用卡(Credit Cards)。想了解更多信息，参看[PKPaymentRequest 类参考](https://developer.apple.com/library/prerelease/ios/documentation/PassKit/Reference/PKPaymentRequest_Ref/index.html#//apple_ref/doc/uid/TP40014832)中的_" _Payment Networks"。

    2.发卡机构和支付网络可以直接在他们的App中向Apple Pay添加卡。想了解更多信息，参看[PKAddPaymentPassViewController类参考](https://developer.apple.com/library/prerelease/ios/documentation/PassKit/Reference/PKAddPaymentPassViewController_Class/index.html#//apple_ref/doc/uid/TP40016116)。

####     Safari Services Framework

     Safari Services Framework（SafariServices.framework）包括以下增强功能。

     [FSafariViewController](https://developer.apple.com/library/prerelease/ios/documentation/SafariServices/Reference/SFSafariViewController_Ref/index.html#//apple_ref/occ/cl/SFSafariViewController)可以用来在你的App中显示网页内容。它与Safari浏览器共享Cookie和其他网站数据，并拥有许多的Safari浏览器的强大功能，如Safari自动填充(AutoFill)和Safari阅读器(Reader)。不同于Safari浏览器是，SFSafariViewController的UI是专为显示一个页面，采用了完成按钮让用户可以回到App中去。

    如果你的App仅仅是显示网页内容，但不自定义内容，可以考虑将你的[WKWebView](https://developer.apple.com/library/prerelease/ios/documentation/WebKit/Reference/WKWebView_Ref/index.html#//apple_ref/occ/cl/WKWebView)或基于浏览器的[UIWebView](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIWebView_Class/index.html#//apple_ref/occ/cl/UIWebView)更换为SFSafariViewController。

<a href="" target="_blank"></a>

####     UIKit Framework

     UIKit Framework（UIKit.framework）包括许多增强功能，比如：

     1\. [UIStackView](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIStackView_Class_Reference/index.html#//apple_ref/occ/cl/UIStackView)类，帮助你在堆栈上管理一组子视图（Subviews）,可以水平或垂直排列。

     2\. 在新的[UIView](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIView_Class/index.html#//apple_ref/occ/cl/UIView)中布局锚点（Layout Anchors）（如[leadingAnchor](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIView_Class/index.html#//apple_ref/occ/instp/UIView/leadingAnchor) 和 [widthAnchor](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIView_Class/index.html#//apple_ref/occ/instp/UIView/widthAnchor)），以及[NSLayoutAnchor](https://developer.apple.com/library/prerelease/ios/documentation/AppKit/Reference/NSLayoutAnchor_ClassReference/index.html#//apple_ref/occ/cl/NSLayoutAnchor)和[NSLayoutDimension](https://developer.apple.com/library/prerelease/ios/documentation/AppKit/Reference/NSLayoutDimension_ClassReference/index.html#//apple_ref/occ/cl/NSLayoutDimension)，所有这一切都使布局更加的简单。

     3\. 新的布局指南,帮助你在一个视图（View）应该画的内容（Content）中采用可读的内容边缘（Content Margins）和定义（Define）。有关更多信息,请参看[UILayoutGuide](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UILayoutGuide_Class_Reference/index.html#//apple_ref/occ/cl/UILayoutGuide)。

     4\. 新[UIApplicationDelegate](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIApplicationDelegate_Protocol/index.html#//apple_ref/occ/intf/UIApplicationDelegate)方法可以用来打开一个文档（Document）并修改它,而不是使用文档的一个副本。支持open-in-place功能,也在App中的 info.plist 文件中加入了一个键为LSSupportsOpeningDocumentsInPlace和值为YES的字段。

     5\. UITextInputAssistantItem类，帮助你在快捷键栏（Shortcuts Bar）中布置按钮组（Bar Button Groups）。

     6\. 增强Touch事件，例如能够获得上次刷新显示后可能发生的中间触摸（Intermediate Touches）和触摸预测（Touch Prediction）。

     7\. 增强UIKit动力学，比如支持不规则的碰撞边界,以及新的 [UIFieldBehavior](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIFieldBehavior_class/index.html#//apple_ref/occ/cl/UIFieldBehavior) 类,支持不同的可定制字段类型,并且在 [UIAttachmentBehavior](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIAttachmentBehavior_Class/index.html#//apple_ref/occ/cl/UIAttachmentBehavior) 中附加附件类型。

     8\. [UIUserNotificationAction](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UIUserNotificationAction_class/index.html#//apple_ref/occ/cl/UIUserNotificationAction)新特性，它可以让你在用户通知中进行文本输入。

     9\. 新的[NSDataAsset](https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/NSDataAsset_Class/index.html#//apple_ref/occ/cl/NSDataAsset)类，很容易获取内容调整使适应你的设备的内存和图形处理能力。

    10\. 所有标准UIKit Controls翻转支持从右到左的语言。此外,导航（Navigation）,手势（Gestures）,集合视图（Collection Views）和表格单元布局（Table Cell Layouts）也能相应地翻转。

#### 

* * *

# 弃用的API

     以下API将被弃用：

      1\. 地址簿（Address Book）和地址簿UI框架（Address Book UI frameworks）将使用联系人（Contacts）和联系人UI框架（Contacts UI frameworks）来代替。

      2\. Foundation框架中的 [NSURLConnection](https://developer.apple.com/library/prerelease/ios/documentation/Cocoa/Reference/Foundation/Classes/NSURLConnection_Class/index.html#//apple_ref/occ/cl/NSURLConnection) 将使用[NSURLSession](https://developer.apple.com/library/prerelease/ios/documentation/Foundation/Reference/NSURLSession_class/index.html#//apple_ref/occ/cl/NSURLSession) 代替。

      对于完整的特有API弃用列表，参看 [iOS 9.0 API Diffs](https://developer.apple.com/library/prerelease/ios/releasenotes/General/iOS90APIDiffs/index.html#//apple_ref/doc/uid/TP40016222) 。

* * *

****本文主要基于[苹果iOS9官方文档](https://developer.apple.com/library/prerelease/ios/releasenotes/General/WhatsNewIniOS/Articles/iOS9.html#//apple_ref/doc/uid/TP40016198-DontLinkElementID_13)进行参考翻译，**详细可参考****
**

**1.[iOS9发布说明](https://developer.apple.com/library/prerelease/ios/releasenotes/General/RN-iOSSDK-9.0/index.html#//apple_ref/doc/uid/TP40016202)；**

**2.[iOS 8.3与iOS 9.0 API变化](https://developer.apple.com/library/prerelease/ios/releasenotes/iOS90APIDiffs/index.html#//apple_ref/doc/uid/TP40016222)；**

**3.[iOS设备兼容性参考](https://developer.apple.com/library/prerelease/ios/documentation/documentation/DeviceInformation/Reference/iOSDeviceCompatibility/Introduction/Introduction.html#//apple_ref/doc/uid/TP40013599)。**

* * *

~~~~~~完~~~~~~
