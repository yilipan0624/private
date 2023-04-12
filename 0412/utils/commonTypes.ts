
/**
 * スタックでネーミングするために必要なプロパティ
 */
export type NamingStackProps = {
    /**
     * プロジェクト識別子
     */
    pjPrefix: string,
    /**
     * システム識別子
     */
    systemId: string,
    /**
     * 環境種別 (本番：pro、検証：stg、開発：dev、監査：aud、ログ:log)
     */
    envKey: string,
    /**
     * 同一スタックを複数作成する場合は指定。
     */
    increment: number,
}

/**
 * リソース名のネーミング要素
 */
export type ResourceNamingProps = {
    /**
     * プロジェクト識別子
     */
    pjPrefix: string,
    /**
     * サービス名
    */
    serviceName: string,
    /**
     * システム識別子
     */
    systemId: string,
    /**
     * 環境種別 (本番：pro、検証：stg、開発：dev、監査：aud、ログ:log)
     */
    envKey: string,
    /**
     * 用途
     */
    use?: string
    /**
     * 識別番号(インクリメント) 1-99
     */
    increment?: number
}

/**
 * インスタンスタイプ情報
 */
export type InstanceTypeInfo = {
    /**vCpu */
    vcpu: number,
    /**メモリサイズ */
    memory: number
}