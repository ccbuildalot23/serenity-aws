.PHONY: tf-validate tf-init tf-plan tf-apply tf-destroy

tf-init:
	terraform init -input=false

tf-validate: tf-init
	terraform validate

tf-plan: tf-validate
	terraform plan -input=false -out=pilot.plan

tf-apply: tf-plan
	terraform apply pilot.plan

tf-destroy:
	terraform destroy -auto-approve

tf-format:
	terraform fmt -recursive

tf-clean:
	rm -rf .terraform .terraform.lock.hcl terraform.tfstate terraform.tfstate.backup *.plan