import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBifrostKey1785000002000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'bifrost_key',
                columns: [
                    { name: 'id', type: 'uuid', isPrimary: true },
                    { name: 'value', type: 'varchar', isNullable: false },
                    { name: 'administrator_id', type: 'int', isNullable: true },
                    { name: 'kind', type: 'varchar', default: `'seller'` },
                    { name: 'plan_name', type: 'varchar', isNullable: false },
                    { name: 'is_active', type: 'boolean', default: true },
                    { name: 'expires_at', type: 'timestamp', isNullable: true },
                    { name: 'createdAt', type: 'timestamp', default: 'now()' },
                    { name: 'updatedAt', type: 'timestamp', default: 'now()' },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'bifrost_key',
            new TableIndex({ name: 'IDX_bifrost_key_administrator_id', columnNames: ['administrator_id'] }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('bifrost_key', 'IDX_bifrost_key_administrator_id');
        await queryRunner.dropTable('bifrost_key');
    }
}
