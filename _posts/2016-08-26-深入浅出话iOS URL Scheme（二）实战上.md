layout: post
title: 深入浅出话iOS URL Scheme（二）实战上
date: 2016-08-26 01:12:00.000000000 +08:00



#实战篇（上）

#### 注册自定义URL Scheme

- 首先注册一个自定义的URL Scheme，在工程中找到 info.plist 文件添加URL Types。

![添加URL Types.png](http://upload-images.jianshu.io/upload_images/692407-2bca5fad2cb5b031.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

- 展开URL Types，有一行URL identifier，它是你URL scheme的名字，为了避免与其他App的重复，一般使用翻转域名来定义。

![定义URL identifier.png](http://upload-images.jianshu.io/upload_images/692407-03a5b07eeb0ff919.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


- 在URL identifier的同级目录添加一条URL Schemes,这里值得注意的地方有两点：
- 被创建出的URL Schemes是一个Array，这意味着你可以定义多个URL Scheme；
- URL Scheme其实是对大小写不敏感的，也就是说`schemeDemo`与`schemedemo`的效果其实是一致的，这个后面是可以验证的。

![添加URL Schemes.png](http://upload-images.jianshu.io/upload_images/692407-2f23e30110c98803.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

![定义scheme.png](http://upload-images.jianshu.io/upload_images/692407-dbb89c92eefb4f9f.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

- 整体效果应该是这个样子：
  ![整体效果.png](http://upload-images.jianshu.io/upload_images/692407-b68e844f8134f566.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

#### 相应代码实现
- 我们需要在AppDelegate中实现这个方法：
  `- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url sourceApplication:(NSString *)sourceApplication annotation:(id)annotation;`
  以下是我的实现方式：

```
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url sourceApplication:(NSString *)sourceApplication annotation:(id)annotation {
    
    NSLog(@"从哪个app跳转而来 Bundle ID: %@", sourceApplication);
    NSLog(@"URL scheme:%@", [url scheme]);
    NSLog(@"URL query: %@", [url query]);
    
    // 提示并展示query
    UIAlertView *alertView = [[UIAlertView alloc] initWithTitle:@"打开URL Scheme成功"
                                                        message:[url query]
                                                       delegate:nil
                                              cancelButtonTitle:@"确定"
                                              otherButtonTitles:nil];
    [alertView show];
    
    return YES;
}
```
这段代码值做了2件事打印一些必要的信息到控制台，然后弹出一个提示框告诉你Scheme是否打开成功。其中`query`为查询串，里面存储着参数信息。

#### 打开Scheme
- 下面是验证阶段，我们打开Safari，在地址栏像输入一段普通的URL一样输入我们定义的`Scheme`和://

![驼峰写法.png](http://upload-images.jianshu.io/upload_images/692407-81ee10430b4edecc.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
你可以尝试一下②中的写法，效果是一样的。这也就是我上面说的Scheme对大小写并不敏感。
![非驼峰写法.png](http://upload-images.jianshu.io/upload_images/692407-613c32be2e042c5b.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
- 点击确定键，系统会弹出提示框

![提示是否打开该链接.png](http://upload-images.jianshu.io/upload_images/692407-5b6c9d7104e7c543.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
- 点击打开，便会跳转到我们的App中，并执行我们写好的`- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url sourceApplication:(NSString *)sourceApplication annotation:(id)annotation;`方法

#### 更复杂的Scheme
- 事实上来说，我们可以将我们的Scheme写的更复杂一些，可以带一些我们需要参数过来，像是这样
  ![带参数的Scheme.png](http://upload-images.jianshu.io/upload_images/692407-0db997b90a2295aa.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

- 进入App后的效果如下，显示我们打开成功，并将`?`之后的字符串全部显示了出来，也就是`[url query]`中取到的内容，如果我们需要把相应的参数解析成OC的属性或者变量，那么就需要自己写好对应的解析方法。关于这一点我会在下一篇中详细讲解。
  ![效果图.png](http://upload-images.jianshu.io/upload_images/692407-457e60cbaebfc6e8.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

控制台的输出
![控制台输出.png](http://upload-images.jianshu.io/upload_images/692407-a2ef7a2dc1280eee.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

#### 在代码中直接打开Scheme
- 当然我们还可以不局限于在Safari中打开Scheme，我们还可以在App中借助`openURL`方法直接打开Scheme。我们在demo中的VC里加一个按钮。它的点击事件执行如下代码

```
NSString *scheme = @"schemedemo://?parameter2=openScheme";
[[UIApplication sharedApplication] openURL:[NSURL URLWithString:scheme]];
```
效果与在Safari中打开一致
![直接打开Scheme.png](http://upload-images.jianshu.io/upload_images/692407-ff69fdff2b0da940.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
