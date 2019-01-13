import angular from 'angular';
import ddo from './SMSEditor';


export default angular
	.module('ccms.components.sms.smsEditor', [])
	.directive('ccmsSmsEditor', () => ddo)
	.name;
