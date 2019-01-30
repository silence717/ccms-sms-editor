import * as angular from 'angular';
import { opts, keyword } from '../../../typings/sms';

const escapeRegExp = (str: string): string => {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
};

const regUrlBase = '((([A-Za-z]{3,9}:(?:\\/\\/)?)(?:[-;:&=\\+\\$,\\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\\+\\$,\\w]+@)[A-Za-z0-9.-]+)((?:\\/[\\+~%\\/.\\w-_]*)?\\??(?:[-\\+=&;%@.\\w_]*)#?(?:[.\\!\\/\\\\w]*))?)';

const REG_URL = new RegExp(regUrlBase);
const REG_URL_HASH = new RegExp(regUrlBase + '#');
const DEFAULT_TYPE_NAME = 'default';
const BRACKET_REG = /[【】œþ]/g; // 特殊字符
const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
const htmlEntityCode: any = {
	'&nbsp;': ' ',
	'&lt;': '<',
	'&gt;': '>',
	'&amp;': '&'
};

export default class SMSEditorCtrl {
	public showTips: boolean;
	public opts: opts = this.opts || {};
	public keywordPrefix: string;
	public keywordSuffix: string;
	public trimContent?: boolean = true;
	public _content: HTMLTextAreaElement;
	public _tempHolder: Element;
	public keywordTypes: Array<string>;
	public EMO_BASE_URL: string;
	public keywordTypeDisplay: string;
	public _range: Range;
	public $scope: ng.IScope;
	public $timeout: ng.ITimeoutService;
	public _hasInvalidStr: boolean;
	public _invalidStrClosed: boolean;
	public _hasUrl: boolean;


	constructor($scope: ng.IScope, $element: ng.IRootElementService, $timeout: ng.ITimeoutService) {
		this.showTips = false;
		this.createInput = this.createInput.bind(this);
		this.parseHTML = this.parseHTML.bind(this);
		this.insertKeyword = this.insertKeyword.bind(this);
		this.reFocus = this.reFocus.bind(this);
		this.rememberFocus = this.rememberFocus.bind(this);
		this.onChange = this.onChange.bind(this);
		this.checkoutShortLink = this.checkoutShortLink.bind(this);
		this.$scope = $scope;
		this.$timeout = $timeout;

		// 初始化编辑框及显示
		this.keywordPrefix = this.opts.keywordPrefix || 'œœ';
		this.keywordSuffix = this.opts.keywordSuffix || 'œœ';

		this.trimContent = angular.isDefined(this.opts.trimContent) ? this.opts.trimContent : true;
		this._content = $element[0].querySelector('[data-content]') as HTMLTextAreaElement;
		this._tempHolder = $element[0].querySelector('.sms-temp') as Element;
		this.initKeywords();
		this.initContent(this.opts.content);

		this._content.addEventListener('input', this.onChange, false);

		// 异步加载
		$scope.$watch('ctrl.opts.keywords', (newVal: Array<keyword>, oldVal: Array<keyword>) => {
			if (!(newVal && newVal.length === 0 && oldVal && oldVal.length === 0)) {
				this.initKeywords();
				this.initContent(this.opts.content || '');
			}
		});

		$scope.$watch('ctrl.opts.content', (newVal: string) => {
			this.initContent(newVal || '');
			this.reFocus();
		});

		if (isFirefox) { // 干掉 _moz_resizing
			document.designMode = 'on';
			document.execCommand('enableObjectResizing', false, 'false');
			document.designMode = 'off';
		}

		// 对外暴露短信编辑器 API
		this.opts.api = {
			insertContent: this.insertContent.bind(this),
			insertKeyword: this.insertKeyword.bind(this)
		};
	}


	/**
	 * 构造标签的预览文本
	 * - 如果标签有默认值, 则显示默认值; 否则显示 #标签名#
	 * @param {Array} keywords - 标签列表
	 * @param {string} text - 标签名
	 * @param {string|undefined} type - 标签类型
	 * @returns {string}
	 */
	static createTagPreview(keywords: Array<keyword>, text: string, type = ''): string {
		(type === DEFAULT_TYPE_NAME) && (type = undefined);

		const matchedTag = keywords.filter(item => {
			return item.type === type && item.text === text;
		})[0];

		return matchedTag ? (matchedTag.defaultValue ? `œ${matchedTag.defaultValue}œ` : `œ#${matchedTag.text}#œ`) : `œ#${text}#œ`;
	}


	/**
	 * 将包含 html 的字符串转为文本
	 * e.g. < => &lt;  &nbsp; => &amp;nbsp;
	 * @param text
	 * @returns {string}
	 */
	static flatCode(text: string = '', trimContent: boolean = true): string {
		// 待重构
		if (trimContent) {
			return text.replace(/(&nbsp;?)|(&lt;?)|(&gt;?)|(&amp;?)/g, result => {
				return '&amp;' + result.slice(1);
			}).replace(/</g, '&lt;');
		} else {
			// 针对文本前后空格不 trim 的设置, 将空格转成 &nbsp; 因为 html 不显示文本的前后空格
			return text.replace(/(&nbsp;?)|(&lt;?)|(&gt;?)|(&amp;?)/g, result => {
				return '&amp;' + result.slice(1);
			}).replace(/</g, '&lt;').replace(/\s/g, '&nbsp;');
		}
	}

	static wrap(keyword: keyword, arg = {}): string {
		const obj = Object.assign({prefix: '', suffix: ''}, arg);
		return `${obj.prefix}${keyword}${obj.suffix}`;
	}

	/**
	 * 整理关键词数据, 确定默认显示的关键词分类
	 */
	initKeywords(): void {
		!this.opts.keywords && (this.opts.keywords = []);

		this.keywordTypes = this.opts.keywords.reduce((types, keyword) => {
			if (keyword.type && types.indexOf(keyword.type) === -1) {
				types.push(keyword.type);
			}
			return types;
		}, []);

		this.setKeywordType(this.keywordTypes[0]);
	}


	/**
	 * 设置需要显示的变量类型
	 * @param type
	 */
	setKeywordType(type: string): void {
		this.keywordTypeDisplay = type;

		this.opts.keywords.forEach(keyword => {
			keyword._display = (!type || !keyword.type || keyword.type === type);
		});
	}


	/**
	 * 判断是否要展示箭头
	 * @returns {boolean}
	 */
	testShowToggleOrNot(): boolean {
		const HASH_WIDTH = 7,
			PADDING = 20,
			MARGIN = 5,
			ARROW_PADDING = 45,
			keywordLength = this.opts.keywords.reduce((result, keyword) => {
				return result + (keyword._display
					? keyword.text.length * 12 + HASH_WIDTH + PADDING + MARGIN
					: 0);
			}, 0);

		return keywordLength > this._content.clientWidth - ARROW_PADDING;
	}


	/**
	 * 初始化内容
	 * @param {string} content - 初始文字
	 */
	initContent(content: string): void {
		this._content.innerHTML = this.formatContent(this.parseTag(content));
		this.checkEmpty();
		this.parseHTML();
		if (this.opts.shortLinkTip) {
			this.initShortLink();
		}
	}
	/**
	 * 有手动输入的淘短链时，初始化淘短链tips框的显示
	 * @param {string} content - 初始文字
	 */
	initShortLink(): void {
		const shortLinkReg = new RegExp(/(?:c\.tb\.cn|vcrm\.me|t\.cn)[^<&\s\u4e00-\u9fa5]*/, 'g');
		if (shortLinkReg.test(this._content.innerHTML)) {
			this._content.innerHTML = this._content.innerHTML.replace(shortLinkReg, result => `<a class="shortLinkTips" href=" ">${result}</a>`);
			const shortLinkTags: NodeListOf<HTMLElement> = document.getElementById('sms-content').querySelectorAll('.shortLinkTips');
			if (shortLinkTags.length > 0) {
				// 只让第一个逃短链在打开时候自动弹出提
				for (let i = 0; i < shortLinkTags.length; i++) {
					if (i === 0) {
						this.handleTooltip(shortLinkTags[i], true);
					} else {
						this.handleTooltip(shortLinkTags[i], false);
					}
				}
			}
		}
	}

	/**
	 * 构造插入到文本编辑器的 input 标签
	 * @param {string} text - 标签名
	 * @param {string} type - 标签类型
	 * @returns {string}
	 */
	createInput(text: string, type = DEFAULT_TYPE_NAME, prefix = '', suffix = ''): string {
		// 暂时不需要
		// const padding = (this.keywordTypes.length < 1 || !type) ? 0 : 1.5;

		// return `&nbsp;<input class="sms-keyword-inserted ${padding ? type : DEFAULT_TYPE_NAME}" value="${text}" style="width: ${padding + text.length}em" disabled>&nbsp;`;
		let width = this.getTextWidth(text);

		if (isFirefox) {
			return `${prefix}<img class="sms-keyword-inserted ${type}" value="${text}" alt="${text}" style="width: ${width + 2}px">${suffix}`;
		} else {
			return `${prefix}<input class="sms-keyword-inserted ${type}" value="${text}" style="width: ${width + 2}px" disabled>${suffix}`;
		}
	}

	getTextWidth(text: string): number {
		let element = document.createElement('div');
		element.className = 'sms-content';
		element.style.display = 'inline-block';
		element.style.opacity = '0';
		element.innerHTML = text;
		document.body.appendChild(element);

		let width = window.getComputedStyle(element).width;

		document.body.removeChild(element);

		return parseInt(width, 10);
	}


	/**
	 * 构造插入到文本编辑器中的图片
	 * @param {string} name - 图片名称
	 * @returns {string}
	 */
	createImage(name: string): string {
		return `<img data-emo-name="${name}" src="${this.EMO_BASE_URL}${name}.gif">`;
	}


	/**
	 * 将短信数据中的 tag 标签转化为 input
	 * @param {string} text - 短信数据
	 * @returns {string}
	 */
	parseTag(text = ''): string {
		const varReg = RegExp(`${escapeRegExp(this.keywordPrefix)}_(?:\\[(\\S*?)])?(.+?)_${escapeRegExp(this.keywordSuffix)}`, 'g');
		return SMSEditorCtrl.flatCode(text, this.trimContent)
			.replace(varReg, (result, $1, $2) => {
				return this.createInput(this.keywordTextNameConvert($2, false), $1);
			});
	}

	/**
	 * Keyword name 和 text 字段转换
	 * @param arg
	 * @param argIsText
	 * - true: 输入 text, 转出 name
	 * - false: 输入 name, 转出 text
	 * @returns {*}
	 */
	keywordTextNameConvert(arg: string, argIsText = true): string {
		const keywords = this.opts.keywords;

		let matchedKeyword: keyword;

		if (keywords && keywords.length) {
			matchedKeyword = keywords.find(keyword => keyword[argIsText ? 'text' : 'name'] === arg);
		}

		return matchedKeyword ? matchedKeyword[argIsText ? 'name' : 'text'] : arg;
	}

	/**
	 * get keyword config
	 * @param arg
	 * @param argIsText
	 * - true: 通过 text, 获取 keyword
	 * - false: 通过 name, 获取 keyword
	 * */

	getKeywordConfig(arg: string, argIsText = true): keyword {
		const keywords = this.opts.keywords;

		let matchedKeyword;

		if (keywords && keywords.length) {
			matchedKeyword = keywords.find(keyword => keyword[argIsText ? 'text' : 'name'] === arg);
		}

		return matchedKeyword;
	}

	/**
	 * 将短信数据中的表情转化为 img
	 * @param {string} text - 短信数据
	 * @returns {string}
	 */
	parseImage(text: string): string {
		return text.replace(/\{([^}]+)}/g, (result, $1) => {
			return this.createImage($1);
		});
	}

	/**
	 * 格式化短信数据
	 * */
	formatContent(text: string): string {
		const data = text.split('þ_enter_þ');
		const sms = [];
		for (let item of data) {
			const content = item.length ? `<div>${item}</div>` : '<div><br/></div>';
			sms.push(content);
		}

		let parsed = sms.join('');

		return parsed;
	}


	/**
	 * 解析富文本编辑器中的 HTML, 生成预览文本和最终存到服务器的文本
	 */
	parseHTML(): void {
		let parsed = this._content.innerHTML.trim()
			.replace(/disabled(="[^"]*")?/i, '')
			.replace(/style="[^"]+"/i, '')
			.trim();

		let inputReg = /<input\s+class="sms-keyword-inserted\s*([^"]*)"\s+value="([^"]+)"[^>]*>/ig;

		if (isFirefox) {
			inputReg = /<img\s+class="sms-keyword-inserted\s*([^"]*)"\s+value="([^"]+)"[^>]*>/ig;
		}

		if (!parsed.startsWith('<div>')) {
			const parsedArr = parsed.split('<div>');
			const a = parsed.replace(parsedArr[0], '');
			parsed = `<div>${parsedArr[0]}</div>${a}`;
		}

		parsed = parsed.replace(/<\/div>/g, '')
			.replace(/<div>/g, 'þ_enter_þ')
			.replace(/þ_enter_þ/, '');
		this._tempHolder.innerHTML = parsed
			.replace(inputReg, (result, $1, $2) => {
				return SMSEditorCtrl.createTagPreview(this.opts.keywords, $2, $1);
			});

		// 稍后重构
		this.opts.text = parsed
			.replace(inputReg, (result, $1, $2) => {
				if ($1 === DEFAULT_TYPE_NAME) {
					return `${this.keywordPrefix}_${this.keywordTextNameConvert($2)}_${this.keywordSuffix}`;
				}
				return `${this.keywordPrefix}_[${$1}]${this.keywordTextNameConvert($2)}_${this.keywordSuffix}`;
			})
			.replace(/<[^>]+>/g, '')
			.replace(/(&nbsp;)|(&lt;)|(&gt;)|(&amp;)/g, result => {
				return htmlEntityCode[result];
			});
		if (this.trimContent) {
			this.opts.text = this.opts.text.trim();
		}

		// 关键字高亮, URL, 手机及固话号码下划线
		this.opts.preview = SMSEditorCtrl.flatCode(this._tempHolder.textContent, this.trimContent)
			.replace(/œ([^œ]+)œ/g, (result, $1) => {
				return `<span class="sms-tag-preview">${$1.trim()}</span>`;
			})
			.replace(REG_URL_HASH, result => {
				return `<a href="javascript: void(0);">${result.slice(0, result.length - 1)}</a>#`;
			})
			.replace(/(\D|\b)(1[3-9]\d-?\d{4}-?\d{4})(\D|\b)/g, (match, p1, p2, p3) => {
				return `${p1}<a href="javascript: void(0);">${p2}</a>${p3}`;
			})
			.replace(/(\D)((?:[08][1-9]\d{1,2}-?)?[2-9]\d{6,7})(\D)/g, (match, p1, p2, p3) => {
				return `${p1}<a href="javascript: void(0);">${p2}</a>${p3}`;
			});
	}


	/**
	 * 往富文本编辑器中插入标签
	 * @param {string} text - 标签名
	 * @param {string} type - 标签类型
	 * @param {boolean} disabled -标签是否禁用
	 * @param {string} prefix - 前缀
	 * @param {string} suffix - 后缀
	 */
	insertKeyword(text: string, type: string, disabled: boolean, prefix: string, suffix: string): void {
		if (!disabled) {
			if (isFirefox) {
				// TODO: 单前缀和单后缀 光标位置记录
				this.reFocus();
				// 当编辑区域为空的时候,Firefox 会自动加一个换行, 需要重置焦点
				if (this._content.innerHTML === '<div><br></div>') {
					this.focusNode(this._content.querySelector('br'), true);
				}
				document.execCommand('insertHTML', false, this.createInput(text, type, prefix, suffix));
				this.clearMozBr();
				this.parseHTML();
				this.checkEmpty();
				if (this._range.startContainer.nodeType === 1) {
					let offset = this._range.startOffset;
					this._range = this.focusNode(this._range.startContainer.childNodes[offset]);
				} else if (this._range.startContainer.nodeType === 3) {
					// @ts-ignore
					if (this._range.startContainer.length === this._range.startOffset) {
						if (this._range.startContainer.nextSibling) {
							this._range = this.focusNode(this._range.startContainer.nextSibling);
						}
					}
				}
			} else {
				this.reFocus();
				document.execCommand('insertHTML', false, this.createInput(text, type, prefix, suffix));
			}
		}
	}


	/**
	 * 往富文本编辑器中插入表情图片
	 * @param {string} emo - 图片名称
	 */
	insertEmo(emo: string) {
		this.reFocus();
		document.execCommand('insertHTML', false, this.createImage(emo));
	}

	/**
	 * 往富文本编辑器中插入文本内容
	 * @param {string} content - 文本内容
	 */
	insertContent(content: string) {
		this.reFocus();
		document.execCommand('insertHTML', false, content);
	}


	/**
	 * 重新定位光标
	 * - 如果记忆了光标位置, 返回
	 * - 如果之前没有操作过, 则定位到文本框最后
	 */
	reFocus() {

		if (this._range) {
			const selection = window.getSelection();
			selection.removeAllRanges();
			if (this._range.commonAncestorContainer.parentNode.nodeName === 'A') {
				const range = document.createRange();
				range.selectNodeContents(this._content);
				range.collapse(false);
				selection.removeAllRanges();
				selection.addRange(range);
			} else {
				selection.addRange(this._range);
			}
		} else {
			this._content.focus();

			const range = document.createRange();

			range.selectNodeContents(this._content);
			range.collapse(false);

			const selection = window.getSelection();

			selection.removeAllRanges();
			selection.addRange(range);
		}
	}


	/**
	 * 记住光标在编辑器中的位置
	 */
	rememberFocus() {
		const selection = window.getSelection();

		if (selection.rangeCount) {
			this._range = selection.getRangeAt(0);
		}
	}


	/**
	 * 如果文本编辑器为空, 为其添加 empty 样式
	 */
	checkEmpty() {
		(this._content.parentNode as HTMLElement).classList[this._content.innerHTML.length ? 'remove' : 'add']('empty');
	}

	/**
	 * 聚焦Node节点的前面还是后面
	 */
	focusNode(node: Node, isBefore = false): Range {
		const range = document.createRange();
		range.selectNode(node);
		range.collapse(isBefore);
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
		return range;
	}

	focusTextNode(textNode: Node, offset: number) {
		const range = document.createRange();
		range.setStart(textNode, offset);
		range.setEnd(textNode, offset);
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
	}

	/**
	 * 删除Node
	 */
	deleteNode(node: Node) {
		const range = document.createRange();
		range.selectNode(node);
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
		document.execCommand('delete', false, null);
	}

	keydownHandler($event: Event) {
		if (isFirefox) {
			this.controlCursor($event as KeyboardEvent);
		}
	}

	clearMozBr() {
		const br = this._content.querySelector('br[type=_moz]');
		br ? br.parentNode.removeChild(br) : angular.noop();
	}

	controlCursor($event: KeyboardEvent) {
		const range: Range = window.getSelection().getRangeAt(0);
		const node = range.startContainer;
		const preNode = node.childNodes[range.startOffset - 2];
		const currentNode = node.childNodes[range.startOffset - 1];
		const nextNode = node.childNodes[range.startOffset];

		switch ($event.keyCode) {
			case 37: // left
				if (node && node.nodeType === 3) {
					if (range.startOffset === 1) {
						if (range.startContainer.previousSibling) { // {keyword}{text}
							this.focusNode(range.startContainer.previousSibling);
							$event.preventDefault();
						}
					}
					if (range.startOffset === 0) { // {text}
						if (range.startContainer.parentNode && range.startContainer.parentNode.previousSibling) {
							this.focusNode(range.startContainer.parentNode.previousSibling.lastChild);
							$event.preventDefault();
						}
					}
				} else {
					if (preNode && preNode.nodeName === 'IMG') { // {keyword}{keyword}
						this.focusNode(preNode);
						$event.preventDefault();
					} else if (preNode && preNode.nodeType === 3) { // {text}{keyword}
						// @ts-ignore
						this.focusTextNode(preNode, preNode.length);
						$event.preventDefault();
					} else if (preNode === undefined && currentNode !== undefined) { // {keyword}
						this.focusNode(currentNode, true);
						$event.preventDefault();
					} else if (preNode === undefined && currentNode === undefined) { // {keyword}
						if (range.startContainer && range.startContainer.previousSibling) {
							this.focusNode(range.startContainer.previousSibling.lastChild);
							$event.preventDefault();
						}
					}
				}
				break;
			case 39: // right
				if (node && node.nodeType === 3) {
					// @ts-ignore
					if (range.startContainer.length === range.startOffset) { // {text}{keyword}
						if (range.startContainer.nextSibling) {
							this.focusNode(range.startContainer.nextSibling);
							$event.preventDefault();
						} else { // {text}
							if (range.startContainer.parentNode && range.startContainer.parentNode.nextSibling) {
								this.focusNode(range.startContainer.parentNode.nextSibling.firstChild, true);
								$event.preventDefault();
							}
						}
					}
				} else {
					if (nextNode && nextNode.nodeName === 'IMG') { // {keyword}{keyword}
						this.focusNode(nextNode);
						$event.preventDefault();
					} else if (nextNode === undefined) { // {keyword}
						// 火狐下面莫名其妙加入一个 <br>
						if (range.startContainer && range.startContainer.nextSibling && range.startContainer.nextSibling.nodeName === 'DIV') {
							this.focusNode(range.startContainer.nextSibling.firstChild, true);
							$event.preventDefault();
						}
					}
				}
				break;
			case 8: // delete
				if (node && node.nodeType === 3 && range.startOffset === 0) {
					if (range.startContainer.previousSibling) {
						this.deleteNode(range.startContainer.previousSibling);
						$event.preventDefault();
					}
				}
				break;
			case 13: // enter
				// 禁用回车
				// $event.preventDefault();
				// if (currentNode && currentNode.nodeName === 'MARK') {
				// 	document.execCommand('insertHTML', false, '<div><br/></div>');
				// 	$event.preventDefault();
				// }
				// if (node && node.nodeType === 3 && range.startContainer.length === range.startOffset) {
				// 	console.log(node, preNode, currentNode, nextNode);
				// }
				break;
			default:
		}
	}


	/**
	 * 文本修改后, 重置预览文本和最终结果
	 * - !!! 输入时, 过滤【 和 】
	 */
	onChange($event: Event) {

		this.clearMozBr();
		const target: Node = $event.target as Node;
		if ($event && (target.nodeName === 'INPUT' || target.nodeName === 'IMG')) {
			this.focusNode(target);
		}

		this.rememberFocus();

		if (BRACKET_REG.test(this._content.innerHTML)) {

			// 记录初始光标
			const nodes = [].slice.call(this._content.childNodes),
				node = this._range.startContainer,
				inputContent = this._range.startContainer.textContent;

			let offset = this._range.startOffset - 1,
				caretNodeIndex = nodes.indexOf(node);

			if (/^[【】]/.test(inputContent)) {
				caretNodeIndex -= 1;
			}

			// 修改 HTML
			this._content.innerHTML = this._content.innerHTML.replace(BRACKET_REG, '');

			// 恢复光标
			const selection = window.getSelection(),
				range = document.createRange();

			selection.removeAllRanges();

			let newPosNode = this._content.childNodes[caretNodeIndex];

			if (!newPosNode) {

				// 输入位置在头部
				range.selectNode(this._content.firstChild);
				range.collapse(true);
			} else if (newPosNode.nodeType !== 3) {

				// 变量之后
				range.selectNode(newPosNode);
				range.collapse();
			} else {

				// 文字之间
				range.setStart(newPosNode, offset);
				range.setEnd(newPosNode, offset);
			}

			selection.addRange(range);
		} else {
			this.parseHTML();
			this.checkEmpty();
			this._hasUrl = REG_URL.test(this.opts.text) && !REG_URL_HASH.test(this.opts.text);
		}
	}
	/**
	 * 添加短链提示效果
	 * @param currentTag 包含当前复制内容的元素
	 */
	handleTooltip(currentTag: HTMLElement, autoShow = true) {
		let showTip: any = null;
		// 计时
		if (autoShow) {
			this.setToolTip(currentTag, true);
			showTip = this.$timeout(() => {
				this.$timeout.cancel(showTip);
				this.setToolTip(currentTag, false);
			}, 10000);
		}

		// 鼠标划入显示
		currentTag.onmouseenter = () => {
			this.$timeout.cancel(showTip);
			this.setToolTip(currentTag, true);
		};
		// 鼠标划出不显示
		currentTag.onmouseleave = () => {
			this.$timeout.cancel(showTip);
			this.setToolTip(currentTag, false);
		};
	}
	/**
	 * 设置是否显示提示信息
	 * 初始化短信编辑器时，#sms-content已存在，但内容未渲染到页面上，定位不精准，$$phase存在，$apply无法更新dom。因此选用$timeout（）更新。
	 * @param tag 包含短链内容的元素
	 * @param showFlag 是否显示
	 */
	setToolTip(currentTag: HTMLElement, showFlag: boolean) {
		const UI_SPACE_TOP = 6;
		const parentEle: HTMLElement = document.getElementById('sms-content-holder').querySelector('#sms-content');
		const tip = document.getElementById('tip');
		// @ts-ignore
		const TIP_WIDTH = window.getComputedStyle(tip).getPropertyValue('width').split('px')[0] * 1 + window.getComputedStyle(tip).getPropertyValue('padding-right').split('px')[0] * 1;
		// @ts-ignore
		const TIP_HEIGHT = window.getComputedStyle(tip).getPropertyValue('height').split('px')[0] * 1 + window.getComputedStyle(tip).getPropertyValue('padding-top').split('px')[0] * 2 + UI_SPACE_TOP;
		const showTip = this.$timeout(() => {
			this.$timeout.cancel(showTip);
			this.showTips = showFlag;
			if (showFlag) {
				const tipPosition = this.positionCompute(currentTag, parentEle, TIP_WIDTH);
				// @ts-ignore
				this.tipsPosition = {
					left: tipPosition.newLeft + 'px',
					top: parentEle.scrollTop > 0 ? currentTag.offsetTop - parentEle.scrollTop - TIP_HEIGHT + 'px' : currentTag.offsetTop - TIP_HEIGHT + 'px'
				};
				// @ts-ignore
				this.angleStyle = {
					left: tipPosition.angleLeft + 'px'
				};
			}
		}, 0);
	}

	positionCompute(currentTag: HTMLElement, parentEle: HTMLElement , tipWidth: number) {
		const currentWidth = Math.ceil(currentTag.offsetWidth / 2);
		const parentEleWidth = parentEle.offsetWidth;
		const currentPositionLeft = currentTag.offsetLeft;
		const changeFlag = currentPositionLeft + tipWidth;
		const UI_SPACE_LEFT = 12;
		if (changeFlag > parentEleWidth) {
			const newLeft = currentTag.offsetLeft - UI_SPACE_LEFT - (currentPositionLeft + tipWidth - parentEleWidth);
			const angleLeft = currentPositionLeft - newLeft;
			return {
				newLeft,
				angleLeft
			};
		}
		return {
			newLeft: currentTag.offsetLeft - UI_SPACE_LEFT,
			angleLeft: currentWidth
		};
	}

	/**
	 * 不许贴图片和乱七八糟的 html, 也不许贴【 和 】
	 * - 这条代码如果在 firefox 里跑通了, 晚上就去吃大餐 by AshZhang@2016.3.29
	 * @param e
	 */
	onPaste(e: ClipboardEvent) {
		const event = e,
			htmlContent = event.clipboardData.getData('text/html');
		if (htmlContent.indexOf('sms-keyword-inserted') > -1 || htmlContent.indexOf('data-emo-name') > -1) {
			// TODO: 后期考虑使用 <p> 标签做段落处理, 这样可以使用 br 作为行内换行
			if (isFirefox) {
				// const range = window.getSelection().getRangeAt(0);
				// const node = range.startContainer; // 容器
				// // const preNode = node.childNodes[range.startOffset - 2];
				// const currentNode = node.childNodes[range.startOffset - 1];
				// const nextNode = node.childNodes[range.startOffset];
				// // 需要判断光标的位置, 决定html内容插入的位置
				// if (node.id === 'sms-content') { // 说明文本框为空, 光标在最开始
				// 	e.preventDefault();
				// 	document.execCommand('insertHTML', false, htmlContent);
				// } else if (node.nodeType === 1 && currentNode === undefined && nextNode.nodeName === 'BR') { // 内容为 <div><br/></div>
				// 	e.preventDefault();
				// 	this._content.innerHTML = '<br/>';
				// 	this.focusNode(this._content.querySelector('br'), true);
				// 	document.execCommand('insertHTML', false, htmlContent);
				// } else if (node.nodeType === 3) { // 在文本节点内黏贴内容
				// 	// TODO: 临时处理 删除导致换行的 html 标签
				// 	e.preventDefault();
				// 	document.execCommand('insertHTML', false, htmlContent.replace(/<div>/g, '').replace(/<\/div>/g, '').replace(/<br>/g, ''));
				// }
				// 临时处理 删除导致换行的 html 标签
				e.preventDefault();
				document.execCommand('insertHTML', false, htmlContent.replace(/<div>/g, '').replace(/<\/div>/g, '').replace(/<br>/g, ''));
				return;
			} else {
				return;
			}
		}

		e.preventDefault();

		const textContent = event.clipboardData.getData('text/plain');
		const selection = document.getSelection();
		const shortLinkHead = this.includedShortLink(textContent);
		if (this.opts.shortLinkTip && shortLinkHead) {
			document.execCommand('insertHTML', false, `<span>${textContent}</span>`);
			const startSetOff = selection.focusNode.textContent.indexOf(shortLinkHead);
			this.transformToATag(selection, startSetOff, shortLinkHead.length);
		} else {
			this._hasInvalidStr = BRACKET_REG.test(textContent);
			this._invalidStrClosed = !this._hasInvalidStr;
			if (isFirefox) {
				document.execCommand('insertText', false, textContent.replace(BRACKET_REG, '').replace('\n', ''));
			} else {
				document.execCommand('insertText', false, textContent.replace(BRACKET_REG, ''));
			}

		}
	}
	checkoutShortLink() {
		if (this.opts.shortLinkTip) {
			window.requestAnimationFrame(() => {
				if (!this.includedShortLink(this._content.innerHTML)) {
					this.showTips = false;
					if (this.$scope.$$phase) {
						this.$scope.$applyAsync();
					} else {
						this.$scope.$apply();
					}
					return;
				}
				const selection = document.getSelection();
				const shortLinkHead = this.includedShortLink(selection.focusNode.textContent);
				const startOffset = selection.focusNode.textContent.indexOf(shortLinkHead);
				if (startOffset === -1) {
					this.showTips = false;
					if (this.$scope.$$phase) {
						this.$scope.$applyAsync();
					} else {
						this.$scope.$apply();
					}
					return;
				}
				// @ts-ignore
				if (selection.focusNode.parentNode.nodeName.toUpperCase() === 'A' || selection.focusNode.className === 'sms-content') {
					return;
				}
				this.transformToATag(selection, startOffset, shortLinkHead.length);
			});
		}
	}

	transformToATag(selection: any, startOffset: number, contentLength: number) {
		const insertRange = document.createRange();
		insertRange.setStart(selection.focusNode, startOffset);
		insertRange.setEnd(selection.focusNode, startOffset + contentLength);
		selection.removeAllRanges();
		selection.addRange(insertRange);
		document.execCommand('CreateLink', false, ' ');
		const currentNode = selection.focusNode.parentNode;
		this.handleTooltip(currentNode);
		if (currentNode.nextSibling) {
			selection.collapse(currentNode.nextSibling, currentNode.nextSibling.length);
		} else {
			selection.collapse(selection.focusNode, selection.focusOffset);
		}
	}
	includedShortLink(string: string) {
		if (string.indexOf('c.tb.cn') > -1) {
			return 'c.tb.cn';
		}
		if (string.indexOf('vcrm.me') > -1) {
			return 'vcrm.me';
		}
		if (string.indexOf('t.cn') > -1) {
			return 't.cn';
		}
		return null;
	}
}

SMSEditorCtrl.$inject = ['$scope', '$element', '$timeout'];
