export interface keyword {
	name: string,
	type?: string,
	text: string,
	defaultValue?: string,
	_display?: boolean
}

export interface opts {
	keywordPrefix?: string,
	keywordSuffix?: string,
	trimContent?: boolean,
	content?: string,
	api?: object,
	keywords?: Array<keyword>,
	shortLinkTip?: boolean,
	text?: string,
	preview?: string
}
